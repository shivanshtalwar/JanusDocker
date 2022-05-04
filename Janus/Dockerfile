FROM shivanshtalwar0/januscoredeps

LABEL maintainer="shivansh talwar <shivanshtalwar0@gmail.com>"
LABEL description="Provides an image with Janus Gateway"


RUN echo "reload "
COPY ./uri.conv.patch /opt/uri.conv.patch	    
RUN cd ~ \
    && git clone https://github.com/meetecho/janus-gateway.git \
    && cd janus-gateway \
    && git checkout c3c84d22 \
    && git apply /opt/uri.conv.patch \
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
CMD /opt/janus/bin/janus
