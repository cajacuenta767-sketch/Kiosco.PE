CREATE TABLE "bodegas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"telefono" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cambios" (
	"secuencia" bigserial PRIMARY KEY NOT NULL,
	"bodega_id" uuid NOT NULL,
	"dispositivo_id" uuid NOT NULL,
	"tabla" text NOT NULL,
	"registro_id" text NOT NULL,
	"datos" jsonb,
	"borrado" boolean DEFAULT false NOT NULL,
	"actualizado_en" timestamp with time zone NOT NULL,
	"recibido_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "codigos_vinculo" (
	"codigo" text PRIMARY KEY NOT NULL,
	"bodega_id" uuid NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"usado" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispositivos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bodega_id" uuid NOT NULL,
	"nombre" text,
	"token_hash" text NOT NULL,
	"ultimo_sync" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cambios" ADD CONSTRAINT "cambios_bodega_id_bodegas_id_fk" FOREIGN KEY ("bodega_id") REFERENCES "public"."bodegas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cambios" ADD CONSTRAINT "cambios_dispositivo_id_dispositivos_id_fk" FOREIGN KEY ("dispositivo_id") REFERENCES "public"."dispositivos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codigos_vinculo" ADD CONSTRAINT "codigos_vinculo_bodega_id_bodegas_id_fk" FOREIGN KEY ("bodega_id") REFERENCES "public"."bodegas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispositivos" ADD CONSTRAINT "dispositivos_bodega_id_bodegas_id_fk" FOREIGN KEY ("bodega_id") REFERENCES "public"."bodegas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cambios_bodega_secuencia_idx" ON "cambios" USING btree ("bodega_id","secuencia");--> statement-breakpoint
CREATE INDEX "cambios_registro_idx" ON "cambios" USING btree ("bodega_id","tabla","registro_id");--> statement-breakpoint
CREATE INDEX "codigos_bodega_idx" ON "codigos_vinculo" USING btree ("bodega_id");--> statement-breakpoint
CREATE INDEX "dispositivos_token_idx" ON "dispositivos" USING btree ("token_hash");