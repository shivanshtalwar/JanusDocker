FROM shivanshtalwar0/januscoredeps:x86_64

ARG COMMIT_HASH=6e8a3176990c56bf59b730fd440233633afafbda
LABEL maintainer="shivansh talwar <shivanshtalwar0@gmail.com>"
LABEL description="Provides an image with Janus Gateway"
RUN echo "gfdgjjjgf"
COPY *.patch /opt/

RUN git clone https://github.com/Gwumktcorp/janus-gateway.git \
    && cd janus-gateway \
    # && git checkout $COMMIT_HASH \
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
