#!/bin/sh
# Downloads the export libraries into vendor/ (so the site and entry page do not depend on a CDN)
# and prints their SRI hashes. Run once on your computer: sh tools/vendor.sh
set -e
mkdir -p vendor; cd vendor
get() { curl -fsSL -o "$2" "$1"; echo "$2  sha384-$(openssl dgst -sha384 -binary "$2" | openssl base64 -A)"; }
get https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js html2canvas.min.js
get https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js jspdf.umd.min.js
get https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js xlsx.full.min.js
get https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js qrcode.min.js
echo "Done. Commit the vendor folder."
