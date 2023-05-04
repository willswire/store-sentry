/**
 * Reads in the incoming request body
 * Returns either a valid Object or null
 * @param {Request} request the incoming request to read
 */
async function read(request) {
    const { headers } = request;
    const contentType = headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
        return await request.json();
    } else {
        return null;
    }
}

/**
 * Decodes a payload, assuming it is a verified JWT
 * @param {String} signedPayload the assumed JSON web token
 */
function decode(signedPayload) {
    const splitPayload = signedPayload.split(".");
    let encodedPayload = splitPayload[1];
    let decodedPayload = atob(encodedPayload)
    return JSON.parse(decodedPayload)
}

/**
 * Accepts the unique user id of the customer, and after 
 * comparing it with the notification type and subtype,
 * stores the value in the KV database.
 * @param {String} uuid the unique user id of the customer
 */
async function storeToken(uuid, notificationType, subtype) {
    var verdict;

    switch (notificationType) {
        case "DID_RENEW":
        case "OFFER_REDEEMED":
        case "SUBSCRIBED":
            verdict = "ALLOW";
            break;
        case "EXPIRED":
        case "REFUND":
        case "REVOKE":
            verdict = "DENY";
            break;
        case "DID_FAIL_TO_RENEW":
            switch (subtype) {
                case "GRACE_PERIOD":
                    verdict = "ALLOW";
                    break;
                default:
                    verdict = "DENY";
                    break;
            }
            break;
        default:
            break;
    }

    if (verdict === "ALLOW" || verdict === "DENY") {
        await APP_USERS.put(uuid.toUpperCase(), verdict);
    }
}

/**
 * Handles the incoming request
 * Always returns a new Response
 * @param {Request} request the incoming request to handle
 */
async function handle(request) {
    if (request.method === 'POST') {
        const body = await read(request);

        if ("signedPayload" in body) {
            const signedPayload = decode(body.signedPayload)
            const notificationType = signedPayload.notificationType
            const subtype = signedPayload.subtype
            const data = signedPayload.data

            if ("signedTransactionInfo" in data) {
                const signedTransactionInfo = decode(data.signedTransactionInfo)
                const appAccountToken = signedTransactionInfo.appAccountToken
                await storeToken(appAccountToken, notificationType, subtype)

                return new Response(null, {
                    status: 202,
                    statusText: "Accepted"
                });
            }
        }
    }

    return new Response(null, {
        status: 400,
        statusText: "Bad Request"
    });
}

addEventListener('fetch', event => {
    const { request } = event;
    return event.respondWith(handle(request));
});
