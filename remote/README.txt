Host brand.json at https://leonard.lentech.co.ke/lenchat/brand.json

It must be served with this response header so browsers on other domains can read it:
    Access-Control-Allow-Origin: *

Apache (.htaccess in the /lenchat/ folder):
    <IfModule mod_headers.c>
        Header set Access-Control-Allow-Origin "*"
    </IfModule>

What it can change in every LenChat install: the wording of the sidebar support badge,
the donate link (lentech.co.ke hosts only), and an optional one-line announcement in
Settings > About. It cannot remove the credit line, GitHub link or license links.
Installs cache the file for 24 hours.
