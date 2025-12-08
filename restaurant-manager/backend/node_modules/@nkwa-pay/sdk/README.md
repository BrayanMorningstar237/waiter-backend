# pay-js
Nkwa Pay SDK for Javascript

<!-- Start Summary [summary] -->
## Summary

Nkwa Pay API: Use this API to integrate mobile money across your payment flows, create and manage payments, collections, and disbursements.

Read the docs at https://docs.mynkwa.com/api-reference
<!-- End Summary [summary] -->

<!-- Start Table of Contents [toc] -->
## Table of Contents
<!-- $toc-max-depth=2 -->
* [pay-js](#pay-js)
  * [SDK Installation](#sdk-installation)
  * [Requirements](#requirements)
  * [SDK Example Usage](#sdk-example-usage)
  * [Authentication](#authentication)
  * [Available Resources and Operations](#available-resources-and-operations)
  * [Standalone functions](#standalone-functions)
  * [Retries](#retries)
  * [Error Handling](#error-handling)
  * [Server Selection](#server-selection)
  * [Custom HTTP Client](#custom-http-client)
  * [Debugging](#debugging)

<!-- End Table of Contents [toc] -->

<!-- Start SDK Installation [installation] -->
## SDK Installation

The SDK can be installed with either [npm](https://www.npmjs.com/), [pnpm](https://pnpm.io/), [bun](https://bun.sh/) or [yarn](https://classic.yarnpkg.com/en/) package managers.

### NPM

```bash
npm add @nkwa-pay/sdk
```

### PNPM

```bash
pnpm add @nkwa-pay/sdk
```

### Bun

```bash
bun add @nkwa-pay/sdk
```

### Yarn

```bash
yarn add @nkwa-pay/sdk zod

# Note that Yarn does not install peer dependencies automatically. You will need
# to install zod as shown above.
```

> [!NOTE]
> This package is published with CommonJS and ES Modules (ESM) support.


### Model Context Protocol (MCP) Server

This SDK is also an installable MCP server where the various SDK methods are
exposed as tools that can be invoked by AI applications.

> Node.js v20 or greater is required to run the MCP server from npm.

<details>
<summary>Claude installation steps</summary>

Add the following server definition to your `claude_desktop_config.json` file:

```json
{
  "mcpServers": {
    "Pay": {
      "command": "npx",
      "args": [
        "-y", "--package", "@nkwa-pay/sdk",
        "--",
        "mcp", "start",
        "--api-key-auth", "..."
      ]
    }
  }
}
```

</details>

<details>
<summary>Cursor installation steps</summary>

Create a `.cursor/mcp.json` file in your project root with the following content:

```json
{
  "mcpServers": {
    "Pay": {
      "command": "npx",
      "args": [
        "-y", "--package", "@nkwa-pay/sdk",
        "--",
        "mcp", "start",
        "--api-key-auth", "..."
      ]
    }
  }
}
```

</details>

You can also run MCP servers as a standalone binary with no additional dependencies. You must pull these binaries from available Github releases:

```bash
curl -L -o mcp-server \
    https://github.com/{org}/{repo}/releases/download/{tag}/mcp-server-bun-darwin-arm64 && \
chmod +x mcp-server
```

If the repo is a private repo you must add your Github PAT to download a release `-H "Authorization: Bearer {GITHUB_PAT}"`.


```json
{
  "mcpServers": {
    "Todos": {
      "command": "./DOWNLOAD/PATH/mcp-server",
      "args": [
        "start"
      ]
    }
  }
}
```

For a full list of server arguments, run:

```sh
npx -y --package @nkwa-pay/sdk -- mcp start --help
```
<!-- End SDK Installation [installation] -->

<!-- Start Requirements [requirements] -->
## Requirements

For supported JavaScript runtimes, please consult [RUNTIMES.md](RUNTIMES.md).
<!-- End Requirements [requirements] -->

<!-- Start SDK Example Usage [usage] -->
## SDK Example Usage

### Example

```typescript
import { Pay } from "@nkwa-pay/sdk";

const pay = new Pay({
  apiKeyAuth: process.env["PAY_API_KEY_AUTH"] ?? "",
});

async function run() {
  const result = await pay.payments.get({
    id: "7112258c-4254-455f-a167-30549365ca9d",
  });

  console.log(result);
}

run();

```
<!-- End SDK Example Usage [usage] -->

<!-- Start Authentication [security] -->
## Authentication

### Per-Client Security Schemes

This SDK supports the following security scheme globally:

| Name         | Type   | Scheme  | Environment Variable |
| ------------ | ------ | ------- | -------------------- |
| `apiKeyAuth` | apiKey | API key | `PAY_API_KEY_AUTH`   |

To authenticate with the API the `apiKeyAuth` parameter must be set when initializing the SDK client instance. For example:
```typescript
import { Pay } from "@nkwa-pay/sdk";

const pay = new Pay({
  apiKeyAuth: process.env["PAY_API_KEY_AUTH"] ?? "",
});

async function run() {
  const result = await pay.payments.get({
    id: "7112258c-4254-455f-a167-30549365ca9d",
  });

  console.log(result);
}

run();

```
<!-- End Authentication [security] -->

<!-- Start Available Resources and Operations [operations] -->
## Available Resources and Operations

<details open>
<summary>Available methods</summary>

### [availability](docs/sdks/availability/README.md)

* [check](docs/sdks/availability/README.md#check) - Check which operators and operations are currently available.


### [payments](docs/sdks/payments/README.md)

* [get](docs/sdks/payments/README.md#get) - Get the payment (collection or disbursement) with the specified ID.
* [collect](docs/sdks/payments/README.md#collect) - Collect a payment from a phone number.
* [disburse](docs/sdks/payments/README.md#disburse) - Disburse a payment from your balance to a phone number.

</details>
<!-- End Available Resources and Operations [operations] -->

<!-- Start Standalone functions [standalone-funcs] -->
## Standalone functions

All the methods listed above are available as standalone functions. These
functions are ideal for use in applications running in the browser, serverless
runtimes or other environments where application bundle size is a primary
concern. When using a bundler to build your application, all unused
functionality will be either excluded from the final bundle or tree-shaken away.

To read more about standalone functions, check [FUNCTIONS.md](./FUNCTIONS.md).

<details>

<summary>Available standalone functions</summary>

- [`availabilityCheck`](docs/sdks/availability/README.md#check) - Check which operators and operations are currently available.
- [`paymentsCollect`](docs/sdks/payments/README.md#collect) - Collect a payment from a phone number.
- [`paymentsDisburse`](docs/sdks/payments/README.md#disburse) - Disburse a payment from your balance to a phone number.
- [`paymentsGet`](docs/sdks/payments/README.md#get) - Get the payment (collection or disbursement) with the specified ID.

</details>
<!-- End Standalone functions [standalone-funcs] -->

<!-- Start Retries [retries] -->
## Retries

Some of the endpoints in this SDK support retries.  If you use the SDK without any configuration, it will fall back to the default retry strategy provided by the API.  However, the default retry strategy can be overridden on a per-operation basis, or across the entire SDK.

To change the default retry strategy for a single API call, simply provide a retryConfig object to the call:
```typescript
import { Pay } from "@nkwa-pay/sdk";

const pay = new Pay({
  apiKeyAuth: process.env["PAY_API_KEY_AUTH"] ?? "",
});

async function run() {
  const result = await pay.payments.get({
    id: "7112258c-4254-455f-a167-30549365ca9d",
  }, {
    retries: {
      strategy: "backoff",
      backoff: {
        initialInterval: 1,
        maxInterval: 50,
        exponent: 1.1,
        maxElapsedTime: 100,
      },
      retryConnectionErrors: false,
    },
  });

  console.log(result);
}

run();

```

If you'd like to override the default retry strategy for all operations that support retries, you can provide a retryConfig at SDK initialization:
```typescript
import { Pay } from "@nkwa-pay/sdk";

const pay = new Pay({
  retryConfig: {
    strategy: "backoff",
    backoff: {
      initialInterval: 1,
      maxInterval: 50,
      exponent: 1.1,
      maxElapsedTime: 100,
    },
    retryConnectionErrors: false,
  },
  apiKeyAuth: process.env["PAY_API_KEY_AUTH"] ?? "",
});

async function run() {
  const result = await pay.payments.get({
    id: "7112258c-4254-455f-a167-30549365ca9d",
  });

  console.log(result);
}

run();

```
<!-- End Retries [retries] -->

<!-- Start Error Handling [errors] -->
## Error Handling

[`PayError`](./src/models/errors/payerror.ts) is the base class for all HTTP error responses. It has the following properties:

| Property            | Type       | Description                                                                             |
| ------------------- | ---------- | --------------------------------------------------------------------------------------- |
| `error.message`     | `string`   | Error message                                                                           |
| `error.statusCode`  | `number`   | HTTP response status code eg `404`                                                      |
| `error.headers`     | `Headers`  | HTTP response headers                                                                   |
| `error.body`        | `string`   | HTTP body. Can be empty string if no body is returned.                                  |
| `error.rawResponse` | `Response` | Raw HTTP response                                                                       |
| `error.data$`       |            | Optional. Some errors may contain structured data. [See Error Classes](#error-classes). |

### Example
```typescript
import { Pay } from "@nkwa-pay/sdk";
import * as errors from "@nkwa-pay/sdk/models/errors";

const pay = new Pay({
  apiKeyAuth: process.env["PAY_API_KEY_AUTH"] ?? "",
});

async function run() {
  try {
    const result = await pay.payments.get({
      id: "7112258c-4254-455f-a167-30549365ca9d",
    });

    console.log(result);
  } catch (error) {
    // The base class for HTTP error responses
    if (error instanceof errors.PayError) {
      console.log(error.message);
      console.log(error.statusCode);
      console.log(error.body);
      console.log(error.headers);

      // Depending on the method different errors may be thrown
      if (error instanceof errors.HttpError) {
        console.log(error.data$.details); // any[]
        console.log(error.data$.message); // string
        console.log(error.data$.statusCode); // number
      }
    }
  }
}

run();

```

### Error Classes
**Primary errors:**
* [`PayError`](./src/models/errors/payerror.ts): The base class for HTTP error responses.
  * [`HttpError`](./src/models/errors/httperror.ts): Generic error.

<details><summary>Less common errors (6)</summary>

<br />

**Network errors:**
* [`ConnectionError`](./src/models/errors/httpclienterrors.ts): HTTP client was unable to make a request to a server.
* [`RequestTimeoutError`](./src/models/errors/httpclienterrors.ts): HTTP request timed out due to an AbortSignal signal.
* [`RequestAbortedError`](./src/models/errors/httpclienterrors.ts): HTTP request was aborted by the client.
* [`InvalidRequestError`](./src/models/errors/httpclienterrors.ts): Any input used to create a request is invalid.
* [`UnexpectedClientError`](./src/models/errors/httpclienterrors.ts): Unrecognised or unexpected error.


**Inherit from [`PayError`](./src/models/errors/payerror.ts)**:
* [`ResponseValidationError`](./src/models/errors/responsevalidationerror.ts): Type mismatch between the data returned from the server and the structure expected by the SDK. See `error.rawValue` for the raw value and `error.pretty()` for a nicely formatted multi-line string.

</details>
<!-- End Error Handling [errors] -->

<!-- Start Server Selection [server] -->
## Server Selection

### Override Server URL Per-Client

The default server can be overridden globally by passing a URL to the `serverURL: string` optional parameter when initializing the SDK client instance. For example:
```typescript
import { Pay } from "@nkwa-pay/sdk";

const pay = new Pay({
  serverURL: "https://api.pay.staging.mynkwa.com",
  apiKeyAuth: process.env["PAY_API_KEY_AUTH"] ?? "",
});

async function run() {
  const result = await pay.payments.get({
    id: "7112258c-4254-455f-a167-30549365ca9d",
  });

  console.log(result);
}

run();

```
<!-- End Server Selection [server] -->

<!-- Start Custom HTTP Client [http-client] -->
## Custom HTTP Client

The TypeScript SDK makes API calls using an `HTTPClient` that wraps the native
[Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API). This
client is a thin wrapper around `fetch` and provides the ability to attach hooks
around the request lifecycle that can be used to modify the request or handle
errors and response.

The `HTTPClient` constructor takes an optional `fetcher` argument that can be
used to integrate a third-party HTTP client or when writing tests to mock out
the HTTP client and feed in fixtures.

The following example shows how to use the `"beforeRequest"` hook to to add a
custom header and a timeout to requests and how to use the `"requestError"` hook
to log errors:

```typescript
import { Pay } from "@nkwa-pay/sdk";
import { HTTPClient } from "@nkwa-pay/sdk/lib/http";

const httpClient = new HTTPClient({
  // fetcher takes a function that has the same signature as native `fetch`.
  fetcher: (request) => {
    return fetch(request);
  }
});

httpClient.addHook("beforeRequest", (request) => {
  const nextRequest = new Request(request, {
    signal: request.signal || AbortSignal.timeout(5000)
  });

  nextRequest.headers.set("x-custom-header", "custom value");

  return nextRequest;
});

httpClient.addHook("requestError", (error, request) => {
  console.group("Request Error");
  console.log("Reason:", `${error}`);
  console.log("Endpoint:", `${request.method} ${request.url}`);
  console.groupEnd();
});

const sdk = new Pay({ httpClient });
```
<!-- End Custom HTTP Client [http-client] -->

<!-- Start Debugging [debug] -->
## Debugging

You can setup your SDK to emit debug logs for SDK requests and responses.

You can pass a logger that matches `console`'s interface as an SDK option.

> [!WARNING]
> Beware that debug logging will reveal secrets, like API tokens in headers, in log messages printed to a console or files. It's recommended to use this feature only during local development and not in production.

```typescript
import { Pay } from "@nkwa-pay/sdk";

const sdk = new Pay({ debugLogger: console });
```

You can also enable a default debug logger by setting an environment variable `PAY_DEBUG` to true.
<!-- End Debugging [debug] -->

<!-- Placeholder for Future Speakeasy SDK Sections -->
