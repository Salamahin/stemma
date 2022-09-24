import json
from datetime import date

import google_auth_oauthlib
import pkg_resources
from google.oauth2.credentials import Credentials


def lambda_handler(event, context):
    query_str: str = event["rawQueryString"]
    domain_name: str = event["requestContext"]["domainName"]
    url = f"https://{domain_name}/oauth2/idpresponse?{query_str}"
    credentials = exchange_code_to_token(url)
    expires: date = credentials.expiry
    response = {
        "statusCode": 302,
        "body": json.dumps({}),
        "headers": {'Location': f"https://stemma.link"},
        "cookies": [
            cookie("token", credentials.id_token, expires),
            cookie("refresh_token", credentials.refresh_token, expires)
        ],
    }
    return response


def cookie(key: str, value: str, expiration: date) -> str:
    exp = expiration.strftime("%a, %d %b %Y %H:%M:%S GMT")
    return f"{key}={value}; expires={exp}; Path=/; Secure=true; Domain=.stemma.link"


def exchange_code_to_token(url: str) -> Credentials:
    flow = create_flow()
    flow.redirect_uri = url.split('?state=')[0]
    flow.fetch_token(authorization_response=f"{url}")
    return flow.credentials


def create_flow():
    secret_path = pkg_resources.resource_filename(__name__, "secret.json")
    flow = google_auth_oauthlib.flow.Flow.from_client_secrets_file(
        secret_path,
        scopes=['https://www.googleapis.com/auth/userinfo.email',
                'https://www.googleapis.com/auth/userinfo.profile',
                'openid'])
    return flow


if __name__ == '__main__':
    token = exchange_code_to_token(
        url="https://localhost:8072/oauth2/idpresponse?state=Ds7gXTe3PlfkMovacqFfSFyQ2BcKnb&code=4%2F0ARtbsJpvVBvdpqnj46zAa6JeZJaAUrNGZxdCYjG-G2xWTPavtUV765Fne4zj4UW7cQteVg&scope=email+profile+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile+openid&authuser=0&prompt=consent")
    print(token.id_token)
    print(token.expiry)
    print(token.refresh_token)