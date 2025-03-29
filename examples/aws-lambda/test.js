require("dotenv").config();
const handler = require("./dist/index.js").handler;

const event = {
   httpMethod: "GET",
   //path: "/",
   path: "/api/system/config",
   //path: "/assets/main-B6sEDlfs.js",
   headers: {
      "Content-Type": "application/json",
      "User-Agent": "curl/7.64.1",
      Accept: "*/*",
   },
};

const context = {
   awsRequestId: "mocked-request-id",
   functionName: "myMinimalLambda",
   functionVersion: "$LATEST",
   memoryLimitInMB: "128",
   getRemainingTimeInMillis: () => 5000,
};

// Execute the handler
handler(event, context)
   .then((response) => {
      console.log(response.statusCode, response.body);
   })
   .catch((error) => {
      console.error("Error:", error);
   });
