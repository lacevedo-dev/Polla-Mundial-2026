-- Índices compuestos para listado y filtrado de miembros por tenant
CREATE INDEX `TenantMember_tenantId_status_idx` ON `TenantMember`(`tenantId`, `status`);
CREATE INDEX `TenantMember_tenantId_status_role_idx` ON `TenantMember`(`tenantId`, `status`, `role`);
CREATE INDEX `TenantMember_tenantId_status_invitedAt_idx` ON `TenantMember`(`tenantId`, `status`, `invitedAt`);
