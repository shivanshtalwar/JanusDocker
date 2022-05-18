#!/bin/bash -
#===============================================================================
#
#          FILE: deploy.janus.container.sh
#
#         USAGE: ./deploy.janus.container.sh
#
#   DESCRIPTION:
#
#       OPTIONS: ---
#  REQUIREMENTS: ---
#          BUGS: ---
#         NOTES: ---
#        AUTHOR: ORiON
#  ORGANIZATION:
#       CREATED: 28/04/21 12:48
#      REVISION: 1.0
#===============================================================================

set -o nounset                              # Treat unset variables as an error

export $(cat .env | xargs)
JANUS_URI_CONV_ENDPOINT=http://localhost:3000/api/sampleTable/decryptCustomerSipUri?id=
JANUS_URI_CONV_AUTH_TOKEN=vLZAdNKnjANBCQ0cK6i6iteRwmyfM7oilIku6Lwf4ZI
JANUS_COMMIT_HASH=c3c84d22
SCRIPT_PATH=$(dirname "$(realpath -s "$0")")
cd "$SCRIPT_PATH" || exit
sudo docker rm -f janusmy
sudo docker run \
    --name=janusmy \
    --network=host \
	--restart=always \
    --env "URI_CONV_ENDPOINT=${JANUS_URI_CONV_ENDPOINT}" \
    --env "URI_CONV_AUTH_TOKEN=${JANUS_URI_CONV_AUTH_TOKEN}" \
 janusmy
