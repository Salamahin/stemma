
function onSignIn(googleToken) {
  // Google have OK'd the sign-in
  // pass the token into our web app
  credentialExchange(googleToken);
}

function credentialExchange(googleToken) {
  // Create a decoded version of the token so we can print things out
  console.log("Creating decoded token...");
  const googleTokenDecoded = parseJwt(googleToken.credential);
  console.log("Token: " + JSON.stringify(googleTokenDecoded));
  // Output some details onto the browser console to show the token working
  console.log("ID: " + googleTokenDecoded.sub);
  console.log('Full Name: ' + googleTokenDecoded.name);
  console.log("Email: " + googleTokenDecoded.email);

  if (googleTokenDecoded['sub']) {

    // We can't access anything in AWS with a google token...
    // ... so we need to exchange it using Cognito for AWS credentials
    console.log("Exchanging Google Token for AWS credentials...");
    AWS.config.region = 'eu-central-1';
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
      IdentityPoolId: 'eu-central-1:75fe1116-6c46-45b6-aefe-d73746cad523', // MAKE SURE YOU REPLACE THIS
      Logins: {
        'accounts.google.com': googleToken.credential
      }
    });

    // Now lets obtain the credentials we just swapped
    AWS.config.credentials.get(function(err) {
      if (!err) {
        console.log('Exchanged to Cognito Identity Id: ' + AWS.config.credentials.identityId);
        // if we are here, things are working as they should...
        // ... now lets call a function to access images, generate signed URL's and display
        accessApi();
      } else {
        // if we are here, bad things have happened, so we should error.
        document.getElementById('output').innerHTML = "<b>YOU ARE NOT AUTHORISED TO QUERY AWS!</b>";
        console.log('ERROR: ' + err);
      }
    });

  } else {
    console.log('User not logged in!');
  }
}

function accessApi() {
  // Using the temp AWS Credentials, lets connect to S3
  const userAction = async () => {
    const response = await fetch('https://eg-api.stemma.link/hello-world', {
      method: 'GET',
      body: "", // string or object
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const myJson = await response.json(); //extract JSON from the http response
    print(myJson)
  }
}

// A utility function to create HTML.
function getHtml(template) {
  return template.join('\n');
}

// A utility function to decode the google token
function parseJwt(token) {
  var base64Url = token.split('.')[1];
  var base64 = base64Url.replace('-', '+').replace('_', '/');
  var plain_token = JSON.parse(window.atob(base64));
  return plain_token;
};