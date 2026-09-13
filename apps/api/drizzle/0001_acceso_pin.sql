ALTER TABLE "bodegas" ADD COLUMN "pin_hash" text;--> statement-breakpoint
ALTER TABLE "bodegas" ADD COLUMN "intentos_fallidos" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bodegas" ADD COLUMN "bloqueado_hasta" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "bodegas_telefono_idx" ON "bodegas" USING btree ("telefono") WHERE "bodegas"."telefono" is not null;