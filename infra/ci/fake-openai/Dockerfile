FROM python:3.12-alpine

WORKDIR /srv
COPY app.py .

EXPOSE 9990

# -u: unbuffered stdout so request logs appear in `docker compose logs` live.
CMD ["python", "-u", "app.py"]
