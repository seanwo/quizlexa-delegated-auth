# Quizlexa Delegated Authentication Server

This server is used to delegate an [OAuth 2.0](https://tools.ietf.org/html/rfc6749) token request from an Alexa Skill to Quizlet's Authorization Server.

The token returned from Quizlet during user authentication looks similiar to the following as outlined in their [API documentation regarding authorization code flow](https://quizlet.com/api/2.0/docs/authorization-code-flow)

```
{
	"access_token": "46a54395e3d1108ffbc56c7f6ca9dd3d",
	"token_type": "bearer",
	"expires_in": 3600,
	"scope": "read",
	"user_id": "quizletusername"
}
```

All future calls the Quizlet API require both the ["access token"](https://quizlet.com/api/2.0/docs/making-api-calls) and knowledge of the "user_id" from the full token returned above to make [user level API calls](https://quizlet.com/api/2.0/docs/users).  This is the reason why Quizlet returns both the "access_token" and "user_id" as part of the access token request response.

If you setup an Alexa Skill to do account linking and to use an "Auth Code Grant" (using the authorization code grant flow), you will receive the "access_token" as part of the Alexa Skill session:

```
{
    "version": "1.0",
    "session": {
        "new": true,
        "sessionId": "amzn1.echo-api.session.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "application": {
            "applicationId": "amzn1.ask.skill.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        },
        "user": {
            "userId": "amzn1.ask.account.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
            "accessToken": "C725n4lKG0HIZpHPv5emh1Fuz1YO85HjMfVjVOq6"
        },
        "attributes": {}
    },
    "request": {
        "type": "LaunchRequest",
        "requestId": "amzn1.echo-api.request.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "timestamp": "2016-12-20T16:11:48Z",
        "locale": "en-US"
    }
}
```

Notice that the "userId" that you receive is not the Quizlet "user_id", it is an Alex Skills user ID.  This means that using the standard authorization code grant flow setup for your Alexa Skill will provide the Skill with an "access_token" which can be used to call the Quizlet API but with no knowledge of the Quizlet "user_id" needed to do things like query the user's sets or favorites.

This is where this delegate authentication server comes in.

Instead of configuring your Alexa Skill to use an "Auth Code Grant", you can configure it to use an "Implicit Grant".  Configuring the Authorization URL for the Alexa Skill to request an access token from an HTTPS version of **this** server then delegates this server to use its client id and secret (established seperately with Quizlet) to redirect the request to Quizlet (and then back again to Amazon).

Flow:

+ Configure the Alexa Skill site's Authorization URL to be **this** site's /oauth/request_token
+ During account linking, **this** site receives a token request with a random state, client id, and redirect URL from Amazon
+ **This** site then uses its Quizlet client and secret (established seperately with Quizlet) along with a new random state to do a GET /authorize against Quizlet
+ Quizlet prompts the user for login credentials.  Upon a successful login...
+ Quizlet redirects back to **this** sites's /oauth/callback
+ **This** site confirm that the callback presents the proper new random state we set to prevent CSRF along with an authorization code
+ **This** site uses the returned authorization code to perform a POST /oauth/token against Quizlet to get the access token similiar to the one shown above
+ **This** site then repackages the token into a redirect back to Amazon using the original random state, client id, and redirect URL they made during their initial request to this site.  The "magic" is that the "access_token" we repackage to Amazon is now in the format "clientID|accesstoken" so that the Alexa Skill can now parse both pieces of data it needs from the Skill's session's access token in order to call the Quizlet API

Note: Login during account linking must happen with a 10 minute window or it will be considered invalid.  This is because this site must hold on to information between redirect to and from Quizlet.  This is done in the form of a cookie uid that identifies this site's local session storage.  That session storage expires after 10 minutes to keep memory from filling up.

More information on setting up account linking for an Alex Skill can be found at [here](https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/linking-an-alexa-user-with-a-user-in-your-system).
Sites that were helpful during research and development include:
[Lelylan's simple-oauth2 example](https://github.com/lelylan/simple-oauth2/blob/master/example/index.js)
[Juan Pablo Claude's post over at Big Nerd Ranch](https://www.bignerdranch.com/blog/developing-alexa-skills-locally-with-nodejs-account-linking-using-oauth/) although as mentioned this can all be done now at Amazon using an "Auth Code Grant" (unless you need to manipulate the access token returned to Amazon!)
