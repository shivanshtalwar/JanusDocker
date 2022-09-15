# use on linux
FROM shivanshtalwar0/januscoredeps:x86_64
WORKDIR /converter
COPY  ./converter /converter
RUN npm install 
EXPOSE 8010
CMD npm run start 
