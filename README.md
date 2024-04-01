# stemma
[![Scala CI](https://github.com/Salamahin/stemma/actions/workflows/ci.yml/badge.svg)](https://github.com/Salamahin/stemma/actions/workflows/ci.yml)
[![Deploy to AWS](https://github.com/Salamahin/stemma/actions/workflows/cd.yml/badge.svg)](https://github.com/Salamahin/stemma/actions/workflows/cd.yml)


```bash
docker run --name stemma-postgres -e POSTGRES_PASSWORD=mysecretpassword -e POSTGRES_DB=stemma --rm -p 5432:5432 postgres
GOOGLE_CLIENT_ID=??? STEMMA_BACKEND_URL=http://localhost:8090 npm run dev
GOOGLE_CLIENT_ID=??? INVITE_SECRET=sosiska15 JDBC_PASSWORD=mysecretpassword JDBC_URL=jdbc:postgresql://localhost:5432/stemma JDBC_USER=postgres POSTGRES_SECRET=mysecretpassword java -cp io.github.salamahin.stemma.apis.restful.Main 
```   
