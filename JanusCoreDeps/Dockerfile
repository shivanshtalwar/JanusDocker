FROM ubuntu:bionic

LABEL maintainer="shivansh talwar <shivanshtalwar0@gmail.com>"
LABEL description="Provides an image with Janus Gateway dependencies"

RUN apt update -y \
    && apt upgrade -y \
    && apt install aptitude wget -y
RUN apt install software-properties-common -y 

RUN wget -O - https://apt.kitware.com/keys/kitware-archive-latest.asc 2>/dev/null | gpg --dearmor - | tee /etc/apt/trusted.gpg.d/kitware.gpg >/dev/null \
     && apt-add-repository 'deb https://apt.kitware.com/ubuntu/ bionic main' \
     && apt update -y\
     && apt install cmake -y

# RUN wget https://libav.org/releases/libav-12.3.tar.xz -O libav-12.3.tar.xz \
#    && tar -xvf libav-12.3.tar.xz \
#    && cd libav-12.3 \
#    && ./configure \
#    && make \
#    && make install
#RUN apt-get install ffmpeg  libavcodec-dev libavcodec57 libavdevice-dev libavdevice57 libavfilter-dev libavfilter6 libavformat-dev libavformat57 libavresample-dev libavresample3 libavutil-dev libavutil55 libpostproc-dev libpostproc54 libswresample-dev libswresample2 libswscale-dev libswscale4 -y
RUN apt install janus-tools -y
# RUN apt install ffmpeg

RUN apt-get install libavutil-dev libavcodec-dev libavformat-dev -y      
RUN aptitude install -y libmicrohttpd-dev libjansson-dev \
	libssl-dev libsrtp-dev libsofia-sip-ua-dev libglib2.0-dev \
	libopus-dev libogg-dev libcurl4-openssl-dev liblua5.3-dev \
	libconfig-dev pkg-config gengetopt libtool automake libnanomsg-dev graphviz

RUN apt install -y \
    sudo \
    make \
    git \
    graphviz

RUN wget https://github.com/doxygen/doxygen/archive/refs/tags/Release_1_8_11.tar.gz
RUN tar -xf Release_1_8_11.tar.gz
RUN apt-get install flex bison -y
RUN cd doxygen-Release_1_8_11/ && mkdir build \
&& cd build \
&& cmake -G "Unix Makefiles" .. \
&& make \
&& make install

RUN apt install python3 python3-pip nginx -y \
    && pip3 install scikit-build \
	&& pip3 install meson ninja \
	&& export PATH="$PATH:~/.local/bin"

RUN git clone https://gitlab.freedesktop.org/libnice/libnice \
    && cd libnice \
    && meson --prefix=/usr build && ninja -C build && ninja -C build install

RUN cd ~ \
    && git clone https://github.com/cisco/libsrtp.git \
    && cd libsrtp \
    && ./configure --prefix=/usr --enable-openssl \
    && make shared_library \
    && make install

RUN cd ~ \
    && git clone https://github.com/sctplab/usrsctp \
    && cd usrsctp \
    && ./bootstrap \
    && ./configure --prefix=/usr \
    && make \
    && make install

RUN cd ~ \
    && git clone https://github.com/warmcat/libwebsockets.git \
    && cd libwebsockets \
    && mkdir build \
    && cd build \
    && cmake -DLWS_MAX_SMP=1 -DCMAKE_INSTALL_PREFIX:PATH=/usr -DCMAKE_C_FLAGS="-fpic" .. \
    && make \
    && make install
Run cd ~ \ 
	&& git clone https://github.com/eclipse/paho.mqtt.c.git \
	&& cd paho.mqtt.c \
	&& make && make install 

RUN cd ~ \
	&& git clone https://github.com/alanxz/rabbitmq-c \
	&& cd rabbitmq-c \
	&& git submodule init \
	&& git submodule update \
	&& mkdir build && cd build \
	&& cmake -DCMAKE_INSTALL_PREFIX=/usr .. \
	&& make && make install

EXPOSE 7088 8088 8188 8089 7188
EXPOSE 10000-10200/udp
