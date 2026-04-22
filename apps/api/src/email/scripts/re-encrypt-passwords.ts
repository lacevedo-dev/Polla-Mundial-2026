import { PrismaClient } from '@prisma/client';
import { CryptoService } from '../../crypto/crypto.service';

/**
 * Script para re-encriptar las contraseñas SMTP de todos los proveedores
 * Uso: npx ts-node src/email/scripts/re-encrypt-passwords.ts <password>
 */

async function reEncryptPasswords() {
  const prisma = new PrismaClient();
  const cryptoService = new CryptoService();

  try {
    // Obtener la contraseña desde argumentos de línea de comandos
    const password = process.argv[2];
    
    if (!password) {
      console.error('❌ Error: Debes proporcionar la contraseña como argumento');
      console.log('Uso: npx ts-node src/email/scripts/re-encrypt-passwords.ts <password>');
      process.exit(1);
    }

    console.log('🔐 Iniciando re-encriptación de contraseñas SMTP...\n');

    // Obtener todos los proveedores activos
    const providers = await prisma.emailProviderAccount.findMany({
      where: {
        deletedAt: null,
        active: true,
      },
      select: {
        id: true,
        key: true,
        fromEmail: true,
        smtpPassEncrypted: true,
      },
    });

    console.log(`📊 Encontrados ${providers.length} proveedores activos\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const provider of providers) {
      try {
        // Intentar desencriptar la contraseña actual
        let currentPassword: string;
        try {
          currentPassword = cryptoService.decrypt(provider.smtpPassEncrypted);
          console.log(`✓ ${provider.key}: Contraseña actual desencriptada correctamente`);
        } catch {
          // Si falla, usar la contraseña proporcionada
          currentPassword = password;
          console.log(`⚠ ${provider.key}: No se pudo desencriptar, usando contraseña proporcionada`);
        }

        // Re-encriptar con la clave actual del sistema
        const newEncrypted = cryptoService.encrypt(currentPassword);

        // Actualizar en la base de datos
        await prisma.emailProviderAccount.update({
          where: { id: provider.id },
          data: {
            smtpPassEncrypted: newEncrypted,
          },
        });

        console.log(`✅ ${provider.key} (${provider.fromEmail}): Re-encriptado exitosamente\n`);
        successCount++;
      } catch (error) {
        console.error(`❌ ${provider.key}: Error - ${error instanceof Error ? error.message : String(error)}\n`);
        errorCount++;
      }
    }

    console.log('\n📈 Resumen:');
    console.log(`✅ Exitosos: ${successCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log(`📊 Total: ${providers.length}`);

    if (successCount === providers.length) {
      console.log('\n🎉 ¡Todas las contraseñas fueron re-encriptadas exitosamente!');
    } else if (errorCount > 0) {
      console.log('\n⚠️ Algunos proveedores fallaron. Revisa los errores arriba.');
    }

  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

reEncryptPasswords();
