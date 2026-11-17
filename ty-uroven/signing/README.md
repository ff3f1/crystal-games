# Development signing identity

`development.jks` is an intentionally public **development-only** signing key, generated for reproducible installable test builds. Password and alias are in `app/build.gradle`. It is not a production credential. The same key allows updates between builds of this branch.

Do not publish an APK signed with this key to RuStore. For store distribution, configure `KEYSTORE_PATH`, `KEYSTORE_PASSWORD`, `KEY_ALIAS` and `KEY_PASSWORD` with a private production identity. The workflow currently generates development-signed review builds and never publishes to a store.

The v0.8 workflow used a new ephemeral debug key on each runner. Android cannot update such an installed APK with a different certificate. Export a backup in v0.8 before uninstalling it, then import that file into this build. Local migration is automatic when Android permits an in-place update with a matching certificate.
