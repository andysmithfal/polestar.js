const axios = require("axios")
const crypto = require("crypto")
class Polestar {
  #loginFlowTokens = {
    state: null,
    codeVerifier: null,
    codeChallenge: null,
  }
  #credentials = {
    email: null,
    password: null,
  }

  #token = {
    access: null,
    refresh: null,
    expires: null,
  }

  #vehicle = {
    vin: null,
    id: null,
  }

  constructor(email, password) {
    if (!email || !password) {
      throw new Error("Email and password must be provided")
    }
    this.#credentials.email = email
    this.#credentials.password = password
  }

  async login() {
    // Generate tokens required for initial login
    this.#loginFlowTokens.state = this.#generateState()
    const { codeVerifier, codeChallenge } = this.#generatePKCE()
    this.#loginFlowTokens.codeVerifier = codeVerifier
    this.#loginFlowTokens.codeChallenge = codeChallenge

    // Perform login flow
    const { pathToken, cookie } = await this.#getLoginFlowTokens()
    const tokenRequestCode = await this.#performLogin(pathToken, cookie)
    const apiCreds = await this.#getApiToken(tokenRequestCode)
    await this.#storeToken(apiCreds)
    if (!(await this.#checkAuthenticated())) {
      throw new Error("Login failed, token is not valid")
    }
  }

  #generateRandomString(length = 43) {
    const possibleChars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
    let result = ""
    for (let i = 0; i < length; i++) {
      result += possibleChars.charAt(
        Math.floor(Math.random() * possibleChars.length)
      )
    }
    return result
  }

  #generatePKCE() {
    const codeVerifier = this.#generateRandomString()
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url") // URL-safe Base64 encoding
    return { codeVerifier, codeChallenge }
  }

  #generateState() {
    // Generate a 32-character random hexadecimal string
    return crypto.randomBytes(16).toString("hex")
  }

  async #storeToken(token) {
    const apiCreds = token

    const tokenExpiryTime = new Date()
    const secondsToAdd = apiCreds.expires_in
    tokenExpiryTime.setSeconds(
      tokenExpiryTime.getSeconds() + (secondsToAdd - 120)
    )

    this.#token.access = apiCreds.access_token
    this.#token.refresh = apiCreds.refresh_token
    this.#token.expires = tokenExpiryTime
  }

  async #checkAuthenticated() {
    if (!this.#token.access || !this.#token.refresh || !this.#token.expires) {
      throw new Error("Not logged in")
    }
    if (this.#token.expires < new Date()) {
      const apiCreds = await this.#refreshToken()
      this.#storeToken(apiCreds)
    }
    return true
  }

  async #refreshToken() {
    const response = await axios.post(
      "https://pc-api.polestar.com/eu-north-1/auth",
      '{"query":"\\n  query refreshAuthToken($token: String!) {\\n    refreshAuthToken(token: $token) {\\n      access_token\\n      expires_in\\n      id_token\\n      refresh_token\\n    }\\n  }\\n","variables":{"token":"' +
        this.#token.refresh +
        '"}}',
      {
        headers: {
          "cache-control": "no-cache",
          "content-type": "application/json",
          Authorization: "Bearer " + this.#token.access,
          pragma: "no-cache",
        },
        maxRedirects: 0,
        validateStatus: function (status) {
          return true
        },
      }
    )
    const data = await response.data
    const apiCreds = data.data.refreshAuthToken
    return {
      access_token: apiCreds.access_token,
      refresh_token: apiCreds.refresh_token,
      expires_in: apiCreds.expires_in,
    }
  }

  async #performLogin(pathToken, cookie) {
    const response = await axios.post(
      "https://polestarid.eu.polestar.com/as/" +
        pathToken +
        "/resume/as/authorization.ping?client_id=l3oopkc_10",
      {
        "pf.username": this.#credentials.email,
        "pf.pass": this.#credentials.password,
      },
      {
        headers: {
          "cache-control": "no-cache",
          "content-type": "application/x-www-form-urlencoded",
          pragma: "no-cache",
          cookie: cookie,
        },
        maxRedirects: 0,
        validateStatus: function (status) {
          return true
        },
      }
    )

    const redirectUrl = response.headers.location
    const requestTokenRegex = /code=([^&]+)/
    const requestTokenMatch = redirectUrl.match(requestTokenRegex)
    const requestToken = requestTokenMatch ? requestTokenMatch[1] : null
    return requestToken
  }

  async #getLoginFlowTokens() {
    const state = this.#generateState()
    const { codeVerifier, codeChallenge } = this.#generatePKCE()
    const response = await axios.get(
      "https://polestarid.eu.polestar.com/as/authorization.oauth2?client_id=l3oopkc_10&redirect_uri=https%3A%2F%2Fwww.polestar.com%2Fsign-in-callback&response_type=code&scope=openid+profile+email+customer%3Aattributes+customer%3Aattributes%3Awrite&state=" +
        this.#loginFlowTokens.state +
        "&code_challenge=" +
        this.#loginFlowTokens.codeChallenge +
        "&code_challenge_method=S256&response_mode=query&acr_values=urn%3Avolvoid%3Aaal%3Abronze%3Aany&language=en&market=gb",
      {
        headers: {
          "cache-control": "no-cache",
          pragma: "no-cache",
        },
        referrerPolicy: "strict-origin-when-cross-origin",
        body: null,
        maxRedirects: 0,
        method: "GET",
        validateStatus: function (status) {
          return true
        },
      }
    )
    const data = await response
    const redirectUrl = data.headers.location
    const regex = /resumePath=(\w+)/
    const match = redirectUrl.match(regex)
    const pathToken = match ? match[1] : null
    const cookies = response.headers["set-cookie"]
    const cookie = cookies[0].split("; ")[0] + ";"

    return {
      pathToken: pathToken,
      cookie: cookie,
    }
  }

  async #getApiToken(tokenRequestCode) {
    const tokens = {
      grant_type: "authorization_code",
      redirect_uri: "https://www.polestar.com/sign-in-callback",
      code: tokenRequestCode,
      code_verifier: this.#loginFlowTokens.codeVerifier,
      client_id: "l3oopkc_10",
    }
    const response = await axios.post(
      "https://polestarid.eu.polestar.com/as/token.oauth2",
      tokens,
      {
        headers: {
          "cache-control": "no-cache",
          pragma: "no-cache",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        maxRedirects: 0,
        validateStatus: function (status) {
          return true
        },
      }
    )
    const data = await response.data
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    }
  }

  async getVehicles() {
    if (!(await this.#checkAuthenticated())) {
      throw new Error("Not authenticated")
    }
    const response = await axios.get(
      "https://pc-api.polestar.com/eu-north-1/mystar-v2/?query=query%20getCars%20%7B%0A%20%20getConsumerCarsV2%20%7B%0A%20%20%20%20vin%0A%20%20%20%20internalVehicleIdentifier%0A%20%20%20%20modelYear%0A%20%20%20%20content%20%7B%0A%20%20%20%20%20%20model%20%7B%0A%20%20%20%20%20%20%20%20code%0A%20%20%20%20%20%20%20%20name%0A%20%20%20%20%20%20%20%20__typename%0A%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20images%20%7B%0A%20%20%20%20%20%20%20%20studio%20%7B%0A%20%20%20%20%20%20%20%20%20%20url%0A%20%20%20%20%20%20%20%20%20%20angles%0A%20%20%20%20%20%20%20%20%20%20__typename%0A%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%20%20__typename%0A%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20__typename%0A%20%20%20%20%7D%0A%20%20%20%20hasPerformancePackage%0A%20%20%20%20registrationNo%0A%20%20%20%20deliveryDate%0A%20%20%20%20currentPlannedDeliveryDate%0A%20%20%20%20__typename%0A%20%20%7D%0A%7D&operationName=getCars&variables=%7B%7D",
      {
        headers: {
          "cache-control": "no-cache",
          "content-type": "application/json",
          Authorization: "Bearer " + this.#token.access,
          pragma: "no-cache",
        },
        maxRedirects: 0,
      }
    )
    if (!response.data.data.getConsumerCarsV2) {
      throw new Error("No vehicles found")
    }
    const vehicles = response.data.data.getConsumerCarsV2
    return vehicles
  }

  async setVehicle(vin) {
    if (!(await this.#checkAuthenticated())) {
      throw new Error("Not authenticated")
    }
    const vehicles = await this.getVehicles()
    let vehicle = null
    if (vin) {
      vehicle = vehicles.find((vehicle) => vehicle.vin === vin)
    } else {
      vehicle = vehicles[0]
    }
    if (!vehicle) {
      throw new Error("Vehicle not found")
    }
    this.#vehicle.vin = vehicle.vin
    this.#vehicle.id = vehicle.internalVehicleIdentifier

    return this.#vehicle
  }

  async getBattery() {
    if (!(await this.#checkAuthenticated())) {
      throw new Error("Not authenticated")
    }

    if (!this.#vehicle.vin) {
      throw new Error("No vehicle selected")
    }

    const response = await axios.get(
      "https://pc-api.polestar.com/eu-north-1/mystar-v2?query=query%20GetBatteryData(%24vin%3A%20String!)%20%7B%0A%20%20getBatteryData(vin%3A%20%24vin)%20%7B%0A%20%20%20%20averageEnergyConsumptionKwhPer100Km%0A%20%20%20%20batteryChargeLevelPercentage%0A%20%20%20%20chargerConnectionStatus%0A%20%20%20%20chargingCurrentAmps%0A%20%20%20%20chargingPowerWatts%0A%20%20%20%20chargingStatus%0A%20%20%20%20estimatedChargingTimeMinutesToTargetDistance%0A%20%20%20%20estimatedChargingTimeToFullMinutes%0A%20%20%20%20estimatedDistanceToEmptyKm%0A%20%20%20%20estimatedDistanceToEmptyMiles%0A%20%20%20%20eventUpdatedTimestamp%20%7B%0A%20%20%20%20%20%20iso%0A%20%20%20%20%20%20unix%0A%20%20%20%20%20%20__typename%0A%20%20%20%20%7D%0A%20%20%20%20__typename%0A%20%20%7D%0A%7D&operationName=GetBatteryData&variables=%7B%22vin%22%3A%22" +
        this.#vehicle.vin +
        "%22%7D",
      {
        headers: {
          "cache-control": "no-cache",
          "content-type": "application/json",
          Authorization: "Bearer " + this.#token.access,
          pragma: "no-cache",
        },
        maxRedirects: 0,
      }
    )
    const data = await response.data.data.getBatteryData
    return data
  }

  async getOdometer() {
    if (!(await this.#checkAuthenticated())) {
      throw new Error("Not authenticated")
    }

    if (!this.#vehicle.vin) {
      throw new Error("No vehicle selected")
    }

    const response = await axios.get(
      "https://pc-api.polestar.com/eu-north-1/mystar-v2?query=query%20GetOdometerData(%24vin%3A%20String!)%20%7B%0A%20%20getOdometerData(vin%3A%20%24vin)%20%7B%0A%20%20%20%20averageSpeedKmPerHour%0A%20%20%20%20eventUpdatedTimestamp%20%7B%0A%20%20%20%20%20%20iso%0A%20%20%20%20%20%20unix%0A%20%20%20%20%20%20__typename%0A%20%20%20%20%7D%0A%20%20%20%20odometerMeters%0A%20%20%20%20tripMeterAutomaticKm%0A%20%20%20%20tripMeterManualKm%0A%20%20%20%20__typename%0A%20%20%7D%0A%7D&operationName=GetOdometerData&variables=%7B%22vin%22%3A%22" +
        this.#vehicle.vin +
        "%22%7D",
      {
        headers: {
          "cache-control": "no-cache",
          "content-type": "application/json",
          Authorization: "Bearer " + this.#token.access,
          pragma: "no-cache",
        },
        maxRedirects: 0,
      }
    )
    const data = await response.data.data.getOdometerData
    return data
  }

  async getHealthData() {
    if (!(await this.#checkAuthenticated())) {
      throw new Error("Not authenticated")
    }

    if (!this.#vehicle.vin) {
      throw new Error("No vehicle selected")
    }

    const response = await axios.get(
      "https://pc-api.polestar.com/eu-north-1/mystar-v2?query=query%20GetHealthData(%24vin%3A%20String!)%20%7B%0A%20%20getHealthData(vin%3A%20%24vin)%20%7B%0A%20%20%20%20brakeFluidLevelWarning%0A%20%20%20%20daysToService%0A%20%20%20%20distanceToServiceKm%0A%20%20%20%20engineCoolantLevelWarning%0A%20%20%20%20eventUpdatedTimestamp%20%7B%0A%20%20%20%20%20%20iso%0A%20%20%20%20%20%20unix%0A%20%20%20%20%7D%0A%20%20%20%20oilLevelWarning%0A%20%20%20%20serviceWarning%0A%20%20%7D%0A%7D&operationName=GetHealthData&variables=%7B%22vin%22%3A%22" +
        this.#vehicle.vin +
        "%22%7D",
      {
        headers: {
          "cache-control": "no-cache",
          "content-type": "application/json",
          Authorization: "Bearer " + this.#token.access,
          pragma: "no-cache",
        },
        maxRedirects: 0,
      }
    )
    const data = await response.data.data.getHealthData
    return data
  }
}

module.exports = Polestar
