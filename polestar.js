const axios = require("axios")

class Polestar {
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
    const { pathToken, cookie } = await this.#getLoginFlowTokens()
    const tokenRequestCode = await this.#performLogin(pathToken, cookie)
    const apiCreds = await this.#getApiToken(tokenRequestCode)
    await this.#storeToken(apiCreds)
    if (!(await this.#checkAuthenticated())) {
      throw new Error("Login failed, token is not valid")
    }
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
    // if (await this.#checkTokenValidity()) {
    //   return true
    // } else {
    //   throw new Error("Token is not valid or refresh token has expired")
    // }
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

  async #checkTokenValidity() {
    const response = await axios.get(
      "https://pc-api.polestar.com/eu-north-1/mystar-v2/?query=query%20introspectToken(%24token%3A%20String!)%20%7B%0A%20%20introspectToken(token%3A%20%24token)%20%7B%0A%20%20%20%20active%0A%20%20%20%20__typename%0A%20%20%7D%0A%7D&operationName=introspectToken&variables=%7B%22token%22%3A%22" +
        this.#token.access +
        "%22%7D",
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
    const data = await response.data.data
    if (!data.introspectToken || !data.introspectToken.active) {
      return false
    } else {
      return true
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
    const uidRegex = /uid=([^&]+)/
    const uidMatch = redirectUrl.match(uidRegex)
    const uid = uidMatch ? uidMatch[1] : null
    await this.#callTermsAndConditions(redirectUrl)
    return await this.#getTokenRequestCode(pathToken, uid, redirectUrl, cookie)
  }

  async #callTermsAndConditions(location) {
    const response = await axios.get(location, {
      headers: {
        "cache-control": "no-cache",
        pragma: "no-cache",
      },
      maxRedirects: 0,
      validateStatus: function (status) {
        return true
      },
    })
    return true
  }

  async #getTokenRequestCode(pathToken, uid, referrer, cookie) {
    const response = await axios.post(
      "https://polestarid.eu.polestar.com/as/" +
        pathToken +
        "/resume/as/authorization.ping",
      {
        subject: uid,
        "pf.submit": "true",
      },
      {
        headers: {
          "cache-control": "no-cache",
          "content-type": "application/x-www-form-urlencoded",
          pragma: "no-cache",
          cookie: cookie,
          referrer: referrer,
        },
        maxRedirects: 0,
        validateStatus: function (status) {
          return true
        },
      }
    )
    const redirectUrl = response.headers.location
    const regex = /code=([^&]+)/
    const match = redirectUrl.match(regex)
    const tokenRequestCode = match ? match[1] : null
    return tokenRequestCode
  }

  async #getLoginFlowTokens() {
    const response = await axios.get(
      "https://polestarid.eu.polestar.com/as/authorization.oauth2?response_type=code&client_id=l3oopkc_10&redirect_uri=https%3A%2F%2Fwww.polestar.com%2Fsign-in-callback&scope=openid%20profile%20email%20customer:attributes%20customer:attributes:write",
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
    const redirectUrl = response.headers.location
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
    const response = await axios.get(
      "https://pc-api.polestar.com/eu-north-1/auth/?query=query%20getAuthToken(%24code%3A%20String!)%20%7B%0A%20%20getAuthToken(code%3A%20%24code)%20%7B%0A%20%20%20%20id_token%0A%20%20%20%20access_token%0A%20%20%20%20refresh_token%0A%20%20%20%20expires_in%0A%20%20%7D%0A%7D%0A&operationName=getAuthToken&variables=%7B%22code%22%3A%22" +
        tokenRequestCode +
        "%22%7D",
      {
        headers: {
          "cache-control": "no-cache",
          "content-type": "application/json",
          pragma: "no-cache",
        },
        maxRedirects: 0,
        validateStatus: function (status) {
          return true
        },
      }
    )
    const data = await response.data
    const apiCreds = data.data.getAuthToken
    return {
      access_token: apiCreds.access_token,
      refresh_token: apiCreds.refresh_token,
      expires_in: apiCreds.expires_in,
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
}

module.exports = Polestar
