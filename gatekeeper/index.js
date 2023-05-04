const update = async (request, env) => {
    const { searchParams } = new URL(request.url)
    const url = new URL(request.url);
    const fullpath = url.pathname.slice(1)
    let key = searchParams.get("key")
    if (key === env.ADMIN_KEY) {
        await env.APP_CONTENT.put(fullpath, request.body);
        return new Response(`Updated ${fullpath} successfully!`);
    } else {
        return new Response("Forbidden", { status: 403 });
    }
}

const read = async (request, env) => {
    const url = new URL(request.url);
    const fullpath = url.pathname.slice(1)
    const subpaths = url.pathname.split("/")
    let plan;

    if (subpaths[1] === "public") {
        plan = await env.APP_CONTENT.get(fullpath);
    } else if (subpaths[1] === "premium") {
        const uuid = url.searchParams.get("uuid")
        const status = await env.APP_USERS.get(uuid)

        if (status === "ALLOW") {
            plan = await env.APP_CONTENT.get(fullpath);
        } else if (status === "DENY") {
            return new Response("Forbidden", { status: 403 });
        }
    } else {
        plan = await env.APP_CONTENT.get("inventory.json");
    }

    const headers = new Headers();
    plan.writeHttpMetadata(headers);
    headers.set("etag", plan.httpEtag);
    return new Response(plan.body, { headers });
}

export default {
    async fetch(request, env, ctx) {
        switch (request.method) {
            case "PUT":
                return update(request, env);
            case "GET":
                return read(request, env);
            default:
                return new Response("Method Not Allowed", { status: 405 });
        }
    }
}