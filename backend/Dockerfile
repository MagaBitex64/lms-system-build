FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
COPY . .

RUN pip install --no-cache-dir -r requirements.txt && \
    sed -i 's/\r$//' entrypoint.sh && \
    chmod +x entrypoint.sh

EXPOSE 8000

ENV PYTHONUNBUFFERED=1

ENTRYPOINT ["./entrypoint.sh"]
