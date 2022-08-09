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
  accessApi(googleToken.credential)
}

function accessApi(token) {
  console.log("Accessing API.. with token: " + token);
  fetch('https://api.stemma.link/hello-world', {
    headers: {
      'Authorization': token
    },
  })
      .then(data => {
        return data.json()
      })
      .then(res => {
        console.log("Successfully received: " + JSON. stringify(res));
        const htmlTemplate = ['<div>', JSON. stringify(res), '</div>'];
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