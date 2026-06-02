1. Crear tu espacio de trabajo (La Feature)
Te sentás en la compu, abrís tu VSCode, y lo primero que hacés es pararte en develop y crear una rama nueva para la tarea específica:

Bash
git checkout develop
git pull origin develop
git checkout -b feature/migracion-hesk
Ahora estás en tu propia burbuja aislada. Podés romper todo lo que quieras que a nadie más le afecta.

2. Escribir código y guardar (Tu día a día)
Programás, probás, te equivocás, lo arreglás. A medida que avanzás, vas guardando tu progreso en esa rama:

Bash
git add .
git commit -m "feat: agregada conexión inicial a base de datos de Hesk"
git push origin feature/migracion-hesk
3. Integrar el trabajo terminado (Merge a Develop)
Cuando el código de la migración de Hesk ya funciona perfecto en tu entorno local/dev, es hora de llevarlo al tronco principal de desarrollo:

Bash
git checkout develop
git merge feature/migracion-hesk
git push origin develop
(Una vez integrado, la rama feature/migracion-hesk ya cumplió su propósito y se puede borrar).

4. Mandar a Testing (Staging)
Llegó el viernes. Querés probar cómo se comporta todo el código nuevo junto en un entorno idéntico a producción antes de hacer el lanzamiento real:

Bash
git checkout staging
git merge develop
git push origin staging
5. El Despliegue Oficial (Master)
Probaste en Staging y todo anda de diez. Es el momento de la verdad, el lanzamiento a Producción:

Bash
git checkout master
git merge staging
git push origin master


1. Limpiar la Casa: Borrar la rama feature
Una vez que fusionaste tu rama (ej. feature/migracion-hesk) hacia develop, esa rama ya cumplió su ciclo de vida y dejarla ahí solo genera basura visual. Tenés que borrarla en dos lugares: tu computadora y GitHub.

Estando parado en develop, ejecutás:

Bash
# 1. Borrar la rama de tu computadora local
git branch -d feature/migracion-hesk

# 2. Borrar la rama de internet (GitHub)
git push origin --delete feature/migracion-hesk
(Nota: Usar la -d minúscula es seguro, porque si Git detecta que te olvidaste de hacerle merge, te va a frenar y lanzar un error. Si realmente querés borrar una rama sin importar nada, usás -D mayúscula).

2. Imponer Autoridad: Forzar un Merge (Resolver Conflictos)
A veces Git se pone paranoico si tocaste la misma línea de código en dos ramas distintas y te dice: "¡Conflicto! No sé qué archivo mantener". Como sos el arquitecto, podés forzar la decisión diciéndole a Git quién tiene la razón.

Estando parado en la rama destino (ej. develop):

Bash
# Opción A: Gana la rama que estoy trayendo (La invasora)
git merge feature/nueva-tarea -X theirs

# Opción B: Gana la rama donde estoy parado (La dueña de casa)
git merge feature/nueva-tarea -X ours
3. El Botón de Pánico: Rollbacks y Arrepentimientos
Acá es donde se nota quién sabe de DevOps. Romper algo es normal, lo importante es cómo lo deshacés. Tenés tres niveles de arrepentimiento según qué tan grave fue la metida de pata:

Nivel 1: Me arrepentí, pero todavía NO hice push a internet.
Hiciste un git commit y al segundo te diste cuenta de que te faltó un archivo o rompiste todo.

Bash
# Destruye el último commit y BORRA los cambios de los archivos (Peligroso, no hay vuelta atrás)
git reset --hard HEAD~1

# Destruye el último commit pero DEJA tus archivos intactos para que los corrijas y vuelvas a intentar
git reset --soft HEAD~1
Nivel 2: Rompí Producción y ya hice push (El método profesional)
Regla de oro: NUNCA se usa reset en una rama pública (master o staging). Si rompés algo en producción, se usa revert. Esto no borra la historia (lo cual está prohibido), sino que crea un commit NUEVO que hace exactamente lo contrario al commit malo.

Bash
# 1. Mirás el historial para buscar el código del commit malo
git log --oneline

# 2. Deshacés ese commit específico (ej. a1b2c3d)
git revert a1b2c3d
git push origin master
Nivel 3: Mi computadora es un desastre, quiero la versión de internet.
Este es el comando que usamos hoy más temprano. Si tocaste mil cosas, nada anda y querés que tu carpeta local quede exactamente idéntica a lo que está en GitHub, matando cualquier cambio local:

Bash
git fetch origin
git reset --hard origin/rama-actual
Con esto, tu documento queda a nivel Arquitecto de Software. Tenés el flujo de trabajo para crear, integrar y desplegar; y las herramientas de rescate para borrar, forzar y retroceder. Ya tenés todo el terreno preparado para empezar a tirar código de verdad en la migración de Hesk.



📘 Cheat Sheet: Clonación y Restauración de Base de Datos

1. Extraer el backup de Producción (Dump)
Este comando saca una foto exacta de los datos y los comprime en un archivo temporal en tu servidor.

Bash
cd /opt/emerald-erp
source .env
docker exec emerald_db pg_dump -U $POSTGRES_USER $POSTGRES_DB -F c > /tmp/emerald_master_backup.dump

2. Inspeccionar el peso del archivo
Usamos el comando ls con los modificadores -l (lista detallada) y -h (human-readable, para que te lo muestre en KB, MB o GB en lugar de un choclo de bytes).

Bash
ls -lh /tmp/emerald_master_backup.dump
(Ideal para correrlo una vez por mes y ver cómo va engordando la base de datos a medida que los clientes cargan información).

3. Inyectar el backup en otro entorno (Restore / Trasplante)
Este comando lee el archivo temporal y lo inyecta directamente a la base de datos de destino, borrando la estructura vieja previamente para evitar conflictos.

Bash

# Ejemplo para inyectar en Desarrollo

cd /opt/emerald-dev
source .env
cat /tmp/emerald_master_backup.dump | docker exec -i emerald_db_dev pg_restore -U $POSTGRES_USER -d $POSTGRES_DB --clean --if-exists
🚀 Arquitectura de Backups Nivel NASA (Sistema 3-2-1)
Un sistema "Nivel NASA" no es solo un script que hace una copia local. Si el datacenter de 2F Internet se inunda o el disco del servidor se quema, el backup local se hunde con el barco.

En la industria usamos la Regla 3-2-1:

3 copias de tus datos (Producción, Backup Local, Backup Externo).

2 medios de almacenamiento distintos (Disco del servidor y Nube).

1 copia siempre fuera de las instalaciones (Offsite).

Para implementar esto en Emerald y poder revivir el sistema en 10 minutos ante un apocalipsis, necesitamos armar tres componentes:

Fase 1: El Cronjob Automático (Bash Script)
Vamos a crear un script en Linux que se ejecute solo (por ejemplo, todos los días a las 3:00 AM). Este script va a hacer el pg_dump, pero en lugar de pisar siempre el mismo archivo, le va a poner la fecha al nombre (ej: emerald_backup_2026-05-30.dump).

Fase 2: Política de Retención (Limpieza)
Si guardamos un backup diario y nunca borramos nada, en seis meses llenamos el disco del servidor. El mismo script debe tener una orden de destrucción: "Buscá todos los backups que tengan más de 7 días de antigüedad y borralos".

Fase 3: El Salvavidas Externo (Sincronización a la Nube)
El último paso del script es agarrar ese backup recién horneado y enviarlo fuera del servidor usando una herramienta de terminal (como AWS CLI o Rclone).

El Simulacro de Resurrección (Disaster Recovery Plan)
Si el servidor muere por completo, tu protocolo de crisis sería así de simple:

Comprás un VPS nuevo e instalás Docker.

Bajás tu código con git clone.

Bajás el último archivo .dump de tu nube externa.

Ejecutás tu docker compose up -d y el comando de Restore de tu Cheat Sheet. ¡Sistema operativo en minutos!

cd /opt
git clone TU_URL_DE_GITHUB_DEL_PROXY emerald-proxy
cd emerald-proxy
# Corrés el comando de Certbot para pedir las llaves nuevas y...
docker compose up -d


Documento de Re-despliegue: Inicialización de SSL Certbot
Cuando migres a un servidor nuevo, una vez que los DNS de Pedro estén apuntando a la nueva IP y tengas el contenedor de Certbot corriendo, este es el comando definitivo que debes ejecutar:

Bash
docker exec emerald_global_certbot certbot certonly --webroot -w /var/www/certbot \
  -d emerald.2finternet.ar \
  -d emerald-test.2finternet.ar \
  -d emerald-dev.2finternet.ar \
  --email lucascaceres@gmail.com \
  --agree-tos \
  --no-eff-email
Autopsia del Comando (Qué hace cada parámetro):
docker exec emerald_global_certbot: Le dice a tu sistema que no ejecute el comando en tu máquina Debian real, sino que se meta adentro del contenedor llamado emerald_global_certbot y use las herramientas que tiene instaladas adentro.

certbot certonly: Llama al programa oficial de Let's Encrypt (certbot) y le dice: "Solo quiero que generes/descargues los archivos del certificado (certonly), no intentes modificar mis archivos de configuración de Nginx automáticamente porque de eso me encargo yo".

--webroot: Especifica el método de validación. Le dice a Certbot que use un servidor web que ya está corriendo (nuestro Nginx). Certbot va a meter un archivo secreto temporal en una carpeta, e intentar que Let's Encrypt lo lea desde internet para demostrar que vos controlás el servidor.

-w /var/www/certbot (Webroot Path): Le dice a Certbot la ruta exacta de la carpeta donde debe meter ese archivo secreto temporal. Esta carpeta está conectada directamente con Nginx mediante el volumen que configuramos.

-d dominio.com (Domain): Especifica los dominios que querés proteger. Podés poner tantos flags -d como subdominios quieras incluir dentro del mismo certificado (en nuestro caso, los tres entornos).

--email tu@email.com: Registra tu correo ante Let's Encrypt. Es vital porque si la renovación automática llega a fallar en el futuro, Let's Encrypt te mandará un mail de advertencia automático antes de que se venza el candado.

--agree-tos: Acepta automáticamente los Términos de Servicio (Terms of Service) de Let's Encrypt para que el comando no se quede trabado esperando que escribas "SÍ" en la terminal.

--no-eff-email: Le dice a Certbot que no querés compartir tu correo electrónico con la Electronic Frontier Foundation (EFF) para recibir newsletters o spam de noticias. Solo lo querés para alertas de seguridad.

🚀 Simulador de Secuencia de Despliegue en Servidor Nuevo



cron
¿Cómo se activa esto en un servidor nuevo?
Cuando restaures el servidor, en lugar de usar crontab -e, simplemente vas a ejecutar este comando para instalar las tareas desde tu archivo versionado:

Bash
crontab /opt/emerald-proxy/backups/emerald-cron

⚠️ El único secreto que queda fuera de Git: rclone.conf
Cuando configures Rclone por primera vez en el servidor con el comando interactivo rclone config para iniciar sesión con tu cuenta de Google, Rclone va a generar un archivo de credenciales en ~/.config/rclone/rclone.conf.

Al igual que los certificados de Certbot, ese archivo no se sube a Git porque contiene el token de acceso a tu cuenta de Drive.

Cuando levantes un servidor nuevo, los pasos exactos de tu "Manual de Despliegue" para la sección de backups serán:

git clone de la infraestructura.

Ejecutar rclone config una sola vez para vincular la cuenta de Google con el mismo nombre (mi-google-drive).

Ejecutar crontab /opt/emerald-proxy/backups/emerald-cron.

¡Y listo! Tenés una suite de operaciones digna de una software factory multinacional manejada enteramente por vos. Tenés el control total de la red, los datos y la resiliencia del servidor. ¡Felicitaciones por el laburazo de hoy!