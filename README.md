# stemma
[![Scala CI](https://github.com/Salamahin/stemma/actions/workflows/ci.yml/badge.svg)](https://github.com/Salamahin/stemma/actions/workflows/ci.yml)
[![Deploy to AWS](https://github.com/Salamahin/stemma/actions/workflows/cd.yml/badge.svg)](https://github.com/Salamahin/stemma/actions/workflows/cd.yml)


# Trello board
https://trello.com/invite/b/ZGWqjKmo/eee45cabf66aa7d377a475169588779d/project-stemma


# Create Google API PROJECT
 
Move to the Google Credentials page https://console.developers.google.com/apis/credentials    
Either sign in, or create a google account

You will be moved to the `Google API Console`     
Click the `Select a project` dropdown, and then click `NEW PROJECT`   
For project name enter `StemmaIDF`  
Click `Create`

# Configure Consent Screen
Click `Credentials`  
Click `CONFIGURE CONSENT SCREEN`    
because our application will be usable by any google user, we have to select external users  
Check the box next to `External` and click `CREATE`  
Next you need to give the application a name ... enter `StemmaIDF` in the `App Name` box.   
enter your own email in `user support email`  
enter your own email in `Developer contact information`  
Click `SAVE AND CONTINUE`   
Click `SAVE AND CONTINUE`  
Click `SAVE AND CONTINUE`  
Click `BACK TO DASHBOARD`


# STAGE 2C - Create Google API PROJECT CREDENTIALS

Click `Credentials` on the menu on the left   
Click `CREATE CREDENTIALS` and then `OAuth client ID`   
In the `Application type download` select `Web Application`   
Under Name enter `StemmaServerlessApp`

We need to add the `WebApp URL`, this is the distribution domain name of the cloudfront distribution (making sure it has https:// before it)  
Click `ADD URI` under `Authorized JavaScript origins`   
Enter the endpoint URL, you need to enter the `Distribution DNS Name` of your CloudFront distribution (created by the 1-click deployment), you should add https:// at the start  
Click `CREATE`

You will be presented with two pieces of information

- `Client ID`
- `Client Secret`

Note down the `Client ID` you will need it later.  
You wont need the `Client Secret` again.  
Once noted down safely, click `OK`   


# Managing database

Could be found here:
```console
https://data.heroku.com/datastores/9902c2a4-3639-491a-ac90-1098e8998579#administration
```
