# ⚠️ DÉPRÉCIÉ — ne pas builder depuis ce repo

La SOURCE DE VÉRITÉ de l'image `gcr.io/themecloud-prod/git-clone-app` est
**`wp-builder/git-clone-app`** (retrouvée le 3 juil. 2026 : l'image prod était
buildée depuis une branche de wp-builder, pas d'ici — ce repo est une variante
antérieure qui divergeait : clé lue en `./new-private-key.pem`, `CLONE_DIR`
ignoré, token loggé).

Les fixes GIT-INTEGRATION §6.1 (installation résolue PAR REPO, KEY_PATH,
retry/backoff, CHECK_ONLY) sont appliqués dans `wp-builder/git-clone-app`.
Ce repo est conservé pour l'historique uniquement. Les `.pem` locaux ne
doivent JAMAIS être commités (cf. .gitignore).
