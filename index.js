"use strict";

const express = require("express");
const axios = require("axios");

const app = express();
const PORT = 3000;

// Define constants
const API_URL = "https://services.leadconnectorhq.com/";
const VALID_MODULES = [
  "contacts", // Lid
  "forms/submissions", // Lid
  "invoices", // altId* altType* Location limit* 1000 offset* 0
  "campaigns", // lid
  "opportunities/search", // Lid
  "funnels/funnel/list", // Lid
  "payments/orders", // altId* altType* Location
  "payments/transactions", // altId* altType* Location
  "payments/subscriptions", // altId* altType* Location
  "products", // Lid
  "surveys/submissions", // Lid
  "users/search", // companyId
];

// Utility functions
function isValidModule(module) {
  return VALID_MODULES.includes(module);
}

function formQueryParams(queryParams) {
  const params = { ...queryParams };
  delete params["module"];
  return params;
}

// Route to handle requests
app.get("/", async (req, res) => {
  // const { module, ...queryParams } = req.query; // Extract `module` and remaining query params
  const module = req.query.module;
  const queryParams = { ...req.query };

  const headers = req.headers;

  // Extract custom headers
  const customHeaders = {};
  if (headers.authorization)
    customHeaders["Authorization"] = headers.authorization;
  if (headers.version) customHeaders["Version"] = headers.version;

  // Set default version if not provided
  const version = customHeaders["Version"] || "2021-07-28";

  // Validate module
  if (!isValidModule(module)) {
    return res.status(400).json({ error: "Invalid module specified." });
  }

  if (!customHeaders["Authorization"]) {
    return res.status(401).json({ error: "Authorization header is required." });
  }

  let idList = [];
  let moduleList = [];
  let finalResponse = {};

  try {
    // Construct API request URL
    const requestUrl = `${API_URL}${module}/`;

    // For contacts
    if (module === "contacts") {
      // Fetch initial list
      const initialResponse = await axios.get(requestUrl, {
        headers: {
          Authorization: customHeaders["Authorization"],
          Version: version,
          "Content-Type": "application/json",
        },
        params: formQueryParams(queryParams),
      });

      const dataList = initialResponse.data[module] || [];
      dataList.forEach((item) => idList.push(item.id));

      // Fetch details for each ID
      await Promise.all(
        idList.map(async (id) => {
          try {
            const detailResponse = await axios.get(`${requestUrl}${id}`, {
              headers: {
                Authorization: customHeaders["Authorization"],
                Version: version,
                "Content-Type": "application/json",
              },
            });
            moduleList.push(detailResponse.data);
          } catch (error) {
            console.error(
              `Error fetching details for ID: ${id}`,
              error.message
            );
          }
        })
      );

      finalResponse[module] = moduleList;
    } else if (module === "opportunities/search") {
      const response = await axios.get(requestUrl, {
        headers: {
          Authorization: customHeaders["Authorization"],
          Version: version,
          "Content-Type": "application/json",
        },
        params: { location_id: queryParams["locationId"] },
      });

      finalResponse = response.data;
    } else {
      // For other modules
      const response = await axios.get(requestUrl, {
        headers: {
          Authorization: customHeaders["Authorization"],
          Version: version,
          "Content-Type": "application/json",
        },
        params: formQueryParams(queryParams),
      });

      finalResponse = response.data[`${module}`];
    }

    // Return final response
    res.status(200).json(finalResponse);
  } catch (error) {
    console.error(
      "Error during request processing:",
      error.status,
      error.message
    );
    res
      .status(500)
      .json({ error: "An error occurred while processing the request." });
  }
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
