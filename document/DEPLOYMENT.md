# 🚀 Guía de Despliegue - VIGILA

## Despliegue Local (Desarrollo)

### Opción 1: Desarrollo con Hot Reload

1. **Instalar dependencias localmente:**
```bash
cd backend
npm install
```

2. **Ejecutar solo la base de datos y MinIO:**
```bash
docker compose up -d db storage
```

3. **Ejecutar backend localmente:**
```bash
cd backend
npm start
# O con nodemon para auto-reload:
npm run dev
```

Esto permite cambios instantáneos sin reconstruir el contenedor.

## Despliegue en Producción (AWS Real)

### Prerequisitos

- Cuenta de AWS activa
- AWS CLI configurado
- Terraform o CloudFormation instalado

### Migración Paso a Paso

#### 1. EC2 (Backend)

```bash
# Crear instancia EC2
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.micro \
  --key-name vigila-key \
  --security-groups vigila-sg
```

**Configuración recomendada:**
- AMI: Amazon Linux 2023
- Tipo: t3.micro (Free Tier) o t3.small
- Security Group: Permitir tráfico HTTP en puerto 4000

#### 2. RDS (Base de Datos)

```bash
# Crear instancia RDS MySQL
aws rds create-db-instance \
  --db-instance-identifier vigila-db \
  --db-instance-class db.t3.micro \
  --engine mysql \
  --master-username admin \
  --master-user-password 'TU_PASSWORD_SEGURO'
```

#### 3. S3 (Almacenamiento)

```bash
# Crear bucket S3
aws s3 mb s3://vigila-videos

# Configurar CORS si es necesario
aws s3api put-bucket-cors \
  --bucket vigila-videos \
  --cors-configuration file://cors.json
```

#### 4. Variables de Entorno

Actualizar `.env` con las credenciales reales de AWS:

```env
# AWS RDS
DB_HOST=vigila-db.xxxxx.us-east-1.rds.amazonaws.com
DB_USER=admin
DB_PASSWORD=TU_PASSWORD_SEGURO
DB_NAME=vigila

# AWS S3
S3_ACCESS_KEY=AWS_ACCESS_KEY_ID
S3_SECRET_KEY=AWS_SECRET_ACCESS_KEY
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-east-1
S3_BUCKET=vigila-videos
```

#### 5. Desplegar Backend

```bash
# En la instancia EC2
git clone https://github.com/tu-usuario/vigila-cloud.git
cd vigila-cloud
npm install
npm start
```

### Costos Estimados (AWS Free Tier)

Con el Free Tier de AWS (primer año):

- ✅ EC2: 750 horas/mes GRATIS (t3.micro)
- ✅ RDS: 750 horas/mes GRATIS (db.t3.micro)
- ✅ S3: 5GB de almacenamiento GRATIS
- ⚠️ Transferencia: Primeros 1GB/mes GRATIS

**Costo estimado después del Free Tier:** $10-20 USD/mes

## Despliegue con Docker en AWS

### Opción: ECS (Elastic Container Service)

1. **Crear repositorio ECR:**
```bash
aws ecr create-repository --repository-name vigila
```

2. **Build y push de la imagen:**
```bash
# Login a ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build
docker build -t vigila-backend ./backend

# Tag
docker tag vigila-backend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/vigila:latest

# Push
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/vigila:latest
```

3. **Crear task definition y servicio ECS**

## Seguridad en Producción

### Checklist de Seguridad

- [ ] Usar HTTPS con certificado SSL
- [ ] Rotar credenciales regularmente
- [ ] Habilitar logs de CloudWatch
- [ ] Configurar VPC para aislamiento
- [ ] Implementar WAF si es público
- [ ] Backups automáticos de RDS
- [ ] IAM roles en lugar de credenciales hardcodeadas
- [ ] Encriptación de datos en tránsito y reposo

### Configuración de Seguridad en RDS

```bash
# Habilitar encriptación
aws rds modify-db-instance \
  --db-instance-identifier vigila-db \
  --storage-encrypted \
  --apply-immediately
```

### Security Group Recomendado

```
Inbound Rules:
- Port 22 (SSH) - Solo tu IP
- Port 4000 (HTTP) - Solo Load Balancer
- Port 3306 (MySQL) - Solo EC2 instances
```

## Monitoreo

### CloudWatch Logs

```bash
# Enviar logs a CloudWatch
# Configurar en el código o usar CloudWatch Agent
```

### Alarmas

- CPU > 80%
- Memoria > 80%
- Errores 5xx > 10
- Latencia > 2s

## Backup y Recuperación

### RDS

```bash
# Backup automático diario
aws rds create-db-snapshot \
  --db-instance-identifier vigila-db \
  --db-snapshot-identifier vigila-db-backup-$(date +%Y%m%d)
```

### S3

- Habilitar versionado
- Configurar lifecycle policies
- Replicación cross-region (opcional)

## Escalado

### Auto Scaling

```bash
# Crear auto scaling group para EC2
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name vigila-asg \
  --min-size 1 \
  --max-size 5 \
  --desired-capacity 2 \
  --target-group-arns <target-group-arn>
```

### Load Balancer

```bash
# Crear Application Load Balancer
aws elbv2 create-load-balancer \
  --name vigila-alb \
  --subnets subnet-xxxxx subnet-yyyyy \
  --security-groups sg-xxxxx
```

## Troubleshooting

### Ver logs en producción

```bash
# EC2
ssh -i vigila-key.pem ec2-user@<ec2-ip>
sudo tail -f /var/log/vigila/access.log

# RDS
aws rds describe-db-logs \
  --db-instance-identifier vigila-db
```

### Verificar conectividad

```bash
# Desde EC2 a RDS
mysql -h vigila-db.xxxxx.us-east-1.rds.amazonaws.com -u admin -p

# Desde EC2 a S3
aws s3 ls s3://vigila-videos/
```

