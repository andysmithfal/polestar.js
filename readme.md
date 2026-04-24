# polestar.js

This a barebones Node.js module to facilitate access to the Polestar API. It has been reverse engineered based on the browser based functionality that became availavle on Polestar.com in December 2023. It is currently in development and I make no promises as to its reliability! 

## Using the module

To install the module: 

`npm install @andysmithfal/polestar.js`

In your code, you can require it as so: 

`const Polestar = require("@andysmithfal/polestar.js")`

Provide your Polestar username and password to the constructor: 

`const polestar = new Polestar("email", "password")`

To use the module, first log in. The module will obtain and store an authentication token which is valid for 1 hour. The module will automatically refresh this token when necessary. I am not currently sure how long the refresh token is valid for, but presumably it will not be invalidated if it is continued to be used. 

`await polestar.login()`

You will then need to select a vehicle. `getVehicles()` will return an array of vehicles on the account. 

`const vehicles = await polestar.getVehicles()`

Each vehicle object looks like:

```json
{
  "vin": "LPSAAAAAAAA000000",
  "internalVehicleIdentifier": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "registrationNo": "AB12 CDE",
  "market": "GB",
  "originalMarket": "GB",
  "currentPlannedDeliveryDate": null,
  "deliveryDate": "2023-01-01",
  "edition": "Standard",
  "pno34": "XXXXXXXXXX",
  "modelName": "Polestar 2",
  "modelYear": 2023,
  "commercialModelYear": 2023,
  "computedModelYear": 2023,
  "structureWeek": "202301",
  "userIsPrimaryDriver": true
}
```

You can then call `setVehicle()` to select a vehicle for the below methods. You can call this without any arguments to automatically select the first/only vehicle on the account, or you can specify a VIN as an argument. 

`polestar.setVehicle()`

`polestar.setVehicle("LPSAAAAAAAA000000")`

Once logged in and a vehicle has been set, you can call `getBattery()`, `getOdometer()` and `getHealthData()` to return vehicle information. 

`console.log(await polestar.getBattery())`

Returns this:

```json
{
  "vin": "LPSAAAAAAAA000000",
  "batteryChargeLevelPercentage": 83,
  "chargingStatus": "CHARGING_STATUS_IDLE",
  "estimatedChargingTimeToFullMinutes": 0,
  "estimatedDistanceToEmptyKm": 320,
  "timestamp": {
    "seconds": 1702857600,
    "nanos": 0
  }
}
```

`console.log(await polestar.getOdometer())` 

Will return: 

```json
{
  "vin": "LPSAAAAAAAA000000",
  "odometerMeters": 12345678,
  "timestamp": {
    "seconds": 1702857600,
    "nanos": 0
  }
}
```

`console.log(await polestar.getHealthData())` 

Will return: 

```json
{
  "vin": "LPSAAAAAAAA000000",
  "brakeFluidLevelWarning": "BRAKE_FLUID_LEVEL_WARNING_NO_WARNING",
  "daysToService": 123,
  "distanceToServiceKm": 12345,
  "engineCoolantLevelWarning": "ENGINE_COOLANT_LEVEL_WARNING_NO_WARNING",
  "oilLevelWarning": "OIL_LEVEL_WARNING_NO_WARNING",
  "serviceWarning": "SERVICE_WARNING_NO_WARNING",
  "timestamp": {
    "seconds": 1733522974,
    "nanos": 0
  }
}
```

## Full Example

```javascript
const Polestar = require("@andysmithfal/polestar.js")

const polestar = new Polestar("email", "password")

async function main(){
    await polestar.login()
    await polestar.setVehicle()

    console.log(await polestar.getBattery())
    console.log(await polestar.getOdometer())
    console.log(await polestar.getHealthData())
}

main()
```
