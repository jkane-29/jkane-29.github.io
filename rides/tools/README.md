# Ride data tools

The site never hard-codes ride stats. Everything on the Rides and Map pages comes from
`rides/data/rides.js` and `rides/data/transit.js`, which this folder generates.

## Change the ride list

1. Edit `rides.config.json`. Each ride is one or more RideWithGPS route IDs (the number in
   `ridewithgps.com/routes/<id>`). The first route is the default; any others show up as
   "lengths" you can switch between. Optional per ride: `name`, `region` (`city` / `suburbs` /
   `indiana`), `note`. The route must be public on RideWithGPS.
2. Run:

   ```bash
   python3 rides/tools/build_rides.py
   ```

   Downloads are cached in `.cache/` (gitignored), so re-runs are fast. Add `--refresh` to
   re-download routes, transit schedules and OpenStreetMap checks.

## What gets computed, and from where

| Field | Source |
|---|---|
| Distance, climbing, unpaved %, loop / out & back / one way | RideWithGPS route |
| Biggest climb, steepest 150 m | RideWithGPS elevation profile |
| Road mix (trail / quiet street / bike lane / main road) | RideWithGPS per-point road class, with main-road stretches re-checked against OpenStreetMap for a parallel bike path or a bike lane |
| Start / finish place names | OpenStreetMap Nominatim |
| Nearest bike-friendly station, lines served | CTA, Metra and South Shore Line GTFS feeds |
| South Shore bike stations | mysouthshoreline.com/faq (hard-coded list in `build_rides.py`, so re-check it occasionally) |
| Bike rules text | CTA / Metra via nita.illinois.gov, South Shore FAQ (in `build_rides.py`) |

`calibrate_road_codes.py` is how the RideWithGPS road-class codes were decoded. You only need it
if RideWithGPS changes them.
