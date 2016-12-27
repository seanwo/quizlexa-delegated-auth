'use strict';

require('dotenv').config();

var development = false;
if ((typeof process.env.DEVELOPMENT != 'undefined') && (process.env.DEVELOPMENT == 'true')) {
  development = true;
}

var redirect_urls = process.env.REDIRECT_URLS.split('|');
for (var i = 0; i < redirect_urls.length; i++) {
  redirect_urls[i] = redirect_urls[i].trim();
}

var redirect_host;
if (development == true) {
  redirect_host = 'http://localhost:3000';
} else {
  redirect_host = 'https://quizlexa.com';
}

const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;

const express = require('express');
const app = express();

const session = require('express-session');
app.set('trust proxy', 1);
app.use(session({
  name: 'quizlexa.sid',
  secret: client_secret,
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: (60000 * 10) }
}));

const simpleOauthModule = require('simple-oauth2');
const oauth2 = simpleOauthModule.create({
  client: {
    id: client_id,
    secret: client_secret,
  },
  auth: {
    tokenHost: 'https://api.quizlet.com',
    tokenPath: '/oauth/token',
    authorizeHost: 'https://quizlet.com',
    authorizePath: '/authorize',
  },
});

function createRandomNonce(length) {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function createAuthorizationUri(state, scope) {
  var authorizationUri = oauth2.authorizationCode.authorizeURL({
    redirect_uri: redirect_host + '/oauth/callback',
    scope: scope,
    state: state
  });
  return authorizationUri;
}

app.get('/oauth/request_token', (req, res) => {
  console.log('\nheaders[request_token]: ' + JSON.stringify(req.headers));
  if (req.query.response_type !== 'token') {
    return res.status(400).send('only supports token grant flow');
  }
  var isRedirectUrlValid = false;
  for (var i = 0; i < redirect_urls.length; i++) {
    if (req.query.redirect_uri.startsWith(redirect_urls[i]) == true) {
      isRedirectUrlValid = true;
      break;
    }
  }
  if (isRedirectUrlValid == false) {
    return res.status(400).send('redirection url is not authorized');
  }
  var sess = req.session;
  sess.state = req.query.state;
  sess.client_id = req.query.client_id;
  sess.redirect_uri = req.query.redirect_uri;
  const nonce = createRandomNonce(32);
  sess.nonce = nonce;
  var authorizationUri = createAuthorizationUri(nonce, req.query.scope);
  console.log('session[request_token]: ' + JSON.stringify(sess));
  console.log('redirect[request_token]: ' + authorizationUri);
  res.redirect(authorizationUri);
});

app.get('/oauth/callback', (req, res) => {
  console.log('headers[callback]: ' + JSON.stringify(req.headers));
  var sess = req.session;
  console.log('session[callback]: ' + JSON.stringify(sess));

  if (req.query.state !== sess.nonce) {
    console.error("[session nonce:" + sess.nonce + "] [request state:" + req.query.state + ']');
    return res.status(401).send('CSRF Detected!');
  }

  const code = req.query.code;
  const options = {
    code,
  };

  oauth2.authorizationCode.getToken(options, (error, result) => {
    if (error) {
      console.error('access token error', error.message);
      return res.status(401).send('Authentication failed');
    }
    const token = oauth2.accessToken.create(result);
    var redirectUri = sess.redirect_uri + '#' +
      'state=' + sess.state + '&' +
      'client_id=' + sess.client_id + "&" +
      'access_token=' + result.user_id + '|' + result.access_token + '&' +
      'token_type=Bearer'
    console.log('redirect[callback]: ' + redirectUri);
    return res.redirect(redirectUri);
  });
});

app.get('/oauth/inspect', (req, res) => {
  res.status(200).send(req.url);
});

app.get('/', (req, res) => {
  res.send('Hello<br><a href="/oauth/request_token?' +
    'response_type=token&redirect_uri=' + redirect_host + '/oauth/inspect?vendorId=fakevendor&' +
    'client_id=fakeid&' +
    'state=1234567890&' +
    'scope=read%20write_set' +
    '">Log in with Quizlet</a>');
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Express server started on port ' + (process.env.PORT || 3000));
});
