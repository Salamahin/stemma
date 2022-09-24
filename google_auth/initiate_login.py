import json

import google_auth_oauthlib
import pkg_resources


def lambda_handler(event, context):
    authorization_url, state = generate_login_url('https://api.stemma.link/oauth2/idpresponse')
    response = {"statusCode": 302,
                "headers": {'Location': authorization_url},
                "body": json.dumps({})
                }
    return response


def generate_login_url(redirect_url: str):
    flow = create_flow()
    flow.redirect_uri = redirect_url
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        approval_prompt='force')
    return authorization_url, state


def create_flow():
    secret_path = pkg_resources.resource_filename(__name__, "secret.json")
    flow = google_auth_oauthlib.flow.Flow.from_client_secrets_file(
        secret_path,
        scopes=['https://www.googleapis.com/auth/userinfo.email',
                'https://www.googleapis.com/auth/userinfo.profile',
                'openid'])
    return flow


if __name__ == '__main__':
    url = generate_login_url("https://localhost:8072/oauth2/idpresponse")
    print(url)
