CREATE TABLE "cloud-ide-users" (
	"userId" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"projects" text[] DEFAULT '{}' NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"accessPointId" varchar(255) NOT NULL,
	"refreshToken" varchar(255),
	CONSTRAINT "cloud-ide-users_email_unique" UNIQUE("email")
);
