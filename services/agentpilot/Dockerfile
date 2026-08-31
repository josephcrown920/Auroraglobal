FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    AGENTPILOT_SERVICE_HOST=0.0.0.0 \
    AGENTPILOT_SERVICE_PORT=8788

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py ./
EXPOSE 8788
CMD ["python", "app.py"]
