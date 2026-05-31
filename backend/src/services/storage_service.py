"""
Storage Service — MinIO / S3-compatible Object Storage.

Encapsula la conexión a MinIO y proporciona operaciones de alto nivel:
- ensure_bucket_exists() → crear bucket al startup si no existe
- upload_file() → subir archivo a MinIO y devolver object_key
- get_file_url() → generar URL pública o pre-signed para acceder al archivo
"""

import logging
import uuid
from pathlib import Path
from typing import Optional

import boto3
from botocore.client import Config as BotoConfig
from botocore.exceptions import ClientError

from src import config

logger = logging.getLogger("Emerald.Storage")


class StorageService:
    """
    Servicio de almacenamiento de objetos compatible con S3 (MinIO).

    Uso:
        storage = StorageService()
        storage.ensure_bucket_exists()
        object_key = storage.upload_file(
            file_content=b"...",
            object_name="tickets/42/abc123_screenshot.png",
            content_type="image/png",
        )
        url = storage.get_file_url("tickets/42/abc123_screenshot.png")
    """

    def __init__(self):
        self.endpoint = config.MINIO_ENDPOINT
        self.access_key = config.MINIO_ACCESS_KEY
        self.secret_key = config.MINIO_SECRET_KEY
        self.bucket_name = config.MINIO_BUCKET_NAME
        self.secure = config.MINIO_SECURE
        self.region = config.MINIO_REGION
        self.public_endpoint = config.MINIO_PUBLIC_ENDPOINT

        self._client = None

    @property
    def client(self):
        """Cliente boto3 lazy-loaded (se crea una sola vez)."""
        if self._client is None:
            self._client = boto3.client(
                "s3",
                endpoint_url=f"{'https' if self.secure else 'http'}://{self.endpoint}",
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                region_name=self.region,
                config=BotoConfig(
                    signature_version="s3v4",
                    # No usar path-style para MinIO; las URLs serán del tipo
                    # http://minio:9000/bucket/object
                    s3={"addressing_style": "path"},
                ),
            )
        return self._client

    def ensure_bucket_exists(self) -> None:
        """
        Crea el bucket si no existe. Debe llamarse en el startup de la app.

        Si el bucket ya existe, no hace nada (maneja BucketAlreadyOwnedByYou).
        """
        try:
            self.client.head_bucket(Bucket=self.bucket_name)
            logger.info(f"Bucket '{self.bucket_name}' ya existe.")
        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            if error_code == "404" or error_code == "NoSuchBucket":
                logger.info(f"Bucket '{self.bucket_name}' no encontrado. Creando...")
                self.client.create_bucket(Bucket=self.bucket_name)
                logger.info(f"Bucket '{self.bucket_name}' creado exitosamente.")
            elif error_code == "403":
                logger.warning(
                    f"Sin permisos para verificar bucket '{self.bucket_name}'. "
                    f"Asumiendo que existe. Error: {e}"
                )
            else:
                logger.error(f"Error inesperado al verificar bucket: {e}")
                raise

    def upload_file(
        self,
        file_content: bytes,
        object_name: str,
        content_type: Optional[str] = None,
    ) -> str:
        """
        Sube un archivo a MinIO.

        Args:
            file_content: bytes del archivo
            object_name: key del objeto en MinIO (ej: "tickets/42/uuid_file.png")
            content_type: MIME type del archivo (ej: "image/png")

        Returns:
            object_name (la key del objeto guardado)

        Raises:
            Exception si falla la subida
        """
        extra_args = {}
        if content_type:
            extra_args["ContentType"] = content_type

        try:
            self.client.put_object(
                Bucket=self.bucket_name,
                Key=object_name,
                Body=file_content,
                **extra_args,
            )
            logger.info(f"Archivo subido a MinIO: {object_name} ({len(file_content)} bytes)")
            return object_name
        except Exception as e:
            logger.error(f"Error al subir archivo a MinIO: {e}")
            raise

    def get_file_url(self, object_name: str) -> str:
        """
        Genera la URL pública para acceder al archivo.

        La URL usa MINIO_PUBLIC_ENDPOINT para que sea accesible desde
        el frontend. En entornos donde MinIO no está expuesto directamente,
        se debe configurar MINIO_PUBLIC_ENDPOINT al dominio público o
        dejar que Nginx haga de reverse proxy.

        Args:
            object_name: key del objeto en MinIO

        Returns:
            URL completa al archivo
        """
        scheme = "https" if self.secure else "http"
        return f"{scheme}://{self.public_endpoint}/{self.bucket_name}/{object_name}"

    def delete_file(self, object_name: str) -> bool:
        """
        Elimina un archivo de MinIO.

        Args:
            object_name: key del objeto a eliminar

        Returns:
            True si se eliminó correctamente, False si no existía
        """
        try:
            self.client.delete_object(
                Bucket=self.bucket_name,
                Key=object_name,
            )
            logger.info(f"Archivo eliminado de MinIO: {object_name}")
            return True
        except Exception as e:
            logger.error(f"Error al eliminar archivo de MinIO: {e}")
            return False

    def generate_unique_object_name(self, ticket_id: int, filename: str) -> tuple[str, str]:
        """
        Genera un object_name único y seguro para MinIO.

        Args:
            ticket_id: ID del ticket
            filename: nombre original del archivo

        Returns:
            tuple (object_name, unique_id) donde:
                - object_name: "tickets/{ticket_id}/{uuid}_{safe_filename}{ext}"
                - unique_id: el uuid corto generado
        """
        unique_id = str(uuid.uuid4())[:8]
        safe_filename = Path(filename).stem.replace(" ", "_")
        ext = Path(filename).suffix.lower()
        object_name = f"tickets/{ticket_id}/{unique_id}_{safe_filename}{ext}"
        return object_name, unique_id


# Singleton global — se inicializa bajo demanda
_storage_instance: Optional[StorageService] = None


def get_storage() -> StorageService:
    """
    Devuelve la instancia singleton de StorageService.

    La primera llamada crea el cliente y asegura que el bucket exista.
    Usar esta función en lugar de instanciar StorageService directamente.
    """
    global _storage_instance
    if _storage_instance is None:
        _storage_instance = StorageService()
        try:
            _storage_instance.ensure_bucket_exists()
        except Exception as e:
            logger.warning(
                f"No se pudo verificar/crear el bucket al inicializar StorageService: {e}"
            )
    return _storage_instance