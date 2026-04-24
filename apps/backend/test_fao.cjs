require("dotenv").config();
const axios = require("axios");

axios.get("https://fenixservices.fao.org/faostat/api/v1/en/data/PP", {
    headers: { Authorization: "Bearer " + process.env.FAOSTAT_ACCESS_TOKEN },
    params: { area: "237", element: "5530", item: "27", year: "2020,2021,2022,2023,2024,2025", format: "json" }
}).then(r => {
    if(r.data && r.data.data) {
        console.log(JSON.stringify(r.data.data.map(d => ({year: d.Year, value: d.Value}))));
    } else {
        console.log("No data returned:", r.data);
    }
}).catch(e => console.error("Error:", e.message));
