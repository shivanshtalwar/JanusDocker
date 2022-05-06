
FROM shivanshtalwar0/januscoredeps:2
ARG JANUS_COMMIT_HASH
ARG URI_CONV_AUTH_TOKEN
ARG URI_CONV_ENDPOINT
ENV URI_CONV_AUTH_TOKEN=${URI_CONV_AUTH_TOKEN} 
ENV URI_CONV_ENDPOINT=${URI_CONV_ENDPOINT}
LABEL maintainer="shivansh talwar <shivanshtalwar0@gmail.com>"
LABEL description="Provides an image with Janus Gateway"

COPY *.patch /opt/
# && git apply /opt/encrypted-uri.patch --verbose 
RUN echo ""
RUN cd ~ \
    && git clone https://github.com/meetecho/janus-gateway.git \
    && cd janus-gateway \
    && git checkout "${JANUS_COMMIT_HASH}" \
    && git apply /opt/uri.conv.patch --verbose \
    # && git apply /opt/encrypted-uri.patch --verbose \
    && sh autogen.sh \
    && ./configure --prefix=/opt/janus  \
    && make CFLAGS='-std=c99' \
    && make install \
    && make configs    
COPY conf/*.jcfg /opt/janus/etc/janus/
EXPOSE 10000-10200/udp
EXPOSE 8188
EXPOSE 8088
EXPOSE 8889
EXPOSE 8000
EXPOSE 7088
EXPOSE 7089
CMD  /opt/janus/bin/janus 
