FROM shivanshtalwar0/januscoredeps:x86_64

ARG COMMIT_HASH=45dcf72
LABEL maintainer="shivansh talwar <shivanshtalwar0@gmail.com>"
LABEL description="Provides an image with Janus Gateway"
RUN echo "gfdgjjjgf"
COPY *.patch /opt/

RUN git clone https://github.com/meetecho/janus-gateway.git \
    && cd janus-gateway \
    && git checkout $COMMIT_HASH \
    && git apply /opt/encrypted-uri.patch --verbose \
    && sh autogen.sh \
    && ./configure --prefix=/opt/janus  \
    && make CFLAGS='-std=c99' \
    && make install \
    && make configs    
COPY conf/*.jcfg /opt/janus/etc/janus/
EXPOSE 10000-10200/udp
EXPOSE 8188
EXPOSE 8088
EXPOSE 7088
EXPOSE 7188
CMD  /opt/janus/bin/janus 
