# SourceBD ETL worker.
#
# Built on plain python:slim rather than the Playwright image. Acquisition now
# goes through Firecrawl for every HTML source, so the only remaining browser
# work is `brand_ms` — which has to read a per-contributor embed token out of
# live iframe request headers, something no scrape API exposes — plus a
# last-resort binary download for CDNs that reject a plain client.
#
# That is one browser on one code path, so we install Chromium alone instead of
# inheriting an image carrying Chromium, Firefox and WebKit. `--with-deps`
# installs exactly the system libraries that build of Chromium needs, which is
# what makes dropping the vendor base image safe rather than a gamble on the
# host's shared objects.

FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install -e . \
    && playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*

COPY etl ./etl
COPY supabase ./supabase

ENTRYPOINT ["python", "-m", "etl.cli"]
CMD ["--help"]
