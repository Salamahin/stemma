function onSignIn(googleToken) {
  // Google have OK'd the sign-in
  // pass the token into our web app
  credentialExchange(googleToken);
}

function credentialExchange(googleToken) {
  // Create a decoded version of the token so we can print things out
  console.log("Creating decoded token...");
  const googleTokenDecoded = parseJwt(googleToken.credential);
  
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
      IdentityPoolId: 'eu-central-1:af1b28ad-b6e1-4369-98a4-fcd02004af5c', // MAKE SURE YOU REPLACE THIS
      Logins: {
        'accounts.google.com': googleToken.credential
      }
    });

    // Now let's obtain the credentials we just swapped
    AWS.config.credentials.get(function(err) {
      if (!err) {
        console.log('Exchanged to Cognito Identity Id: ' + AWS.config.credentials.identityId);
        // if we are here, things are working as they should...
        // ... now lets call a function to access api
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
  console.log("Accessing API..");
  fetch('https://api.stemma.link/hello-world')
      .then(data => {
        return data.json()
      })
      .then(res => {
        console.log("Successfully received: " + JSON. stringify(res));
        const htmlTemplate = ['<div>', res['time'], '</div>'];
        document.getElementById('viewer').innerHTML = getHtml(htmlTemplate);
        console.log("Everything is ok")
      })
      .catch(error => console.error(error))
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
}