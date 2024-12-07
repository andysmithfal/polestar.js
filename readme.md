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

You can then call `setVehicle()` to select a vehicle for the below methods. You can call this without any arguments to automatically select the first/only vehicle on the account, or you can specify a VIN as an argument. 

`polestar.setVehicle()`

`polestar.setVehicle("LPSAAAAAAAA000000")`

Once logged in and a vehicle has been set, you can call `getBattery()`, `getOdometer()` and `getHealthData()` to return vehcile information. 

`console.log(await polestar.getBattery())`

Returns this:

```json
{
  averageEnergyConsumptionKwhPer100Km: 23,
  batteryChargeLevelPercentage: 83,
  chargerConnectionStatus: 'CHARGER_CONNECTION_STATUS_DISCONNECTED',
  chargingCurrentAmps: null,
  chargingPowerWatts: null,
  chargingStatus: 'CHARGING_STATUS_IDLE',
  estimatedChargingTimeMinutesToTargetDistance: null,
  estimatedChargingTimeToFullMinutes: 0,
  estimatedDistanceToEmptyKm: 320,
  estimatedDistanceToEmptyMiles: 190,
  eventUpdatedTimestamp: {
    iso: '2023-12-18T00:00:00.000Z',
    unix: '1702857600',
    __typename: 'EventUpdatedTimestamp'
  },
  __typename: 'Battery'
}
```

`console.log(await polestar.getOdometer())` 

Will return: 

```json
{
  averageSpeedKmPerHour: 30,
  eventUpdatedTimestamp: {
    iso: '2023-12-18T00:00:00.000Z',
    unix: '1702857600',
    __typename: 'EventUpdatedTimestamp'
  },
  odometerMeters: 12345678,
  tripMeterAutomaticKm: 10,
  tripMeterManualKm: 1000,
  __typename: 'Odometer'
}
```

`console.log(await polestar.getHealthData())` 

Will return: 

```json 
{
  brakeFluidLevelWarning: 'BRAKE_FLUID_LEVEL_WARNING_NO_WARNING',
  daysToService: 123,
  distanceToServiceKm: 12345,
  engineCoolantLevelWarning: 'ENGINE_COOLANT_LEVEL_WARNING_NO_WARNING',
  eventUpdatedTimestamp: { iso: '2024-12-06T22:09:34.000Z', unix: '1733522974' },
  oilLevelWarning: 'OIL_LEVEL_WARNING_NO_WARNING',
  serviceWarning: 'SERVICE_WARNING_NO_WARNING'
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