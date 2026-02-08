# 万年历 · Perpetual Calendar

A perpetual calendar web app with **农历** (Chinese lunar calendar) and **US federal holidays**.

## Features

- **Gregorian calendar** – Navigate any month/year (100 years back, 20 forward).
- **农历 (Lunar)** – Each day shows the corresponding lunar date via [lunar-javascript](https://github.com/6tail/lunar-javascript).
- **US federal holidays** – New Year’s Day, MLK Jr. Day, Presidents’ Day, Memorial Day, Juneteenth, Independence Day, Labor Day, Columbus Day, Veterans Day, Thanksgiving, Christmas.

## Run locally

From the project folder:

```bash
# Python 3
python3 -m http.server 8080

# or Node (npx)
npx serve -p 8080
```

Then open **http://localhost:8080** in your browser.

You can also open `index.html` directly in the browser (some features may depend on loading the lunar script from CDN).
