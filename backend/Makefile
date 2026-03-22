ENV_FILE ?= ../.env
COMPOSE_FILE ?= ../docker-compose.yml

ifneq (,$(wildcard $(ENV_FILE)))
include $(ENV_FILE)
export $(shell sed 's/=.*//' $(ENV_FILE))
endif

.PHONY: start lint tests tests-% testsum swagger swagger-docker migration-% migration-docker-% migrate-up migrate-down migrate-docker-up migrate-docker-down docker docker-test docker-down docker-cache

start:
	@uvicorn app.main:app --host 0.0.0.0 --port $${BACKEND_PORT:-8050} --reload --timeout-keep-alive 600

lint:
	@command -v ruff >/dev/null 2>&1 || (echo "ruff belum terpasang. Install: pip install ruff" && exit 1)
	@ruff check app tests

tests:
	@pytest -v tests

tests-%:
	@pytest -v tests -k $(shell echo $* | sed 's/_/./g')

testsum:
	@pytest -q tests

swagger:
	@echo "FastAPI Swagger UI: http://localhost:$${BACKEND_PORT:-8050}/docs"

swagger-docker:
	@echo "FastAPI Swagger UI: http://localhost:8050/docs"

migration-%:
	@mkdir -p alembic/versions
	@touch alembic/versions/$$(date +%Y%m%d%H%M%S)_$(subst :,_,$*).sql
	@echo "Created migration file: alembic/versions/$$(ls -1 alembic/versions | tail -n 1)"

migration-docker-%:
	@docker run --rm -v $(PWD)/alembic/versions:/migrations migrate/migrate create -ext sql -dir /migrations $(subst :,_,$*)

migrate-up:
	@docker run --rm --network host -v $(PWD)/alembic/versions:/migrations migrate/migrate -path=/migrations -database "postgres://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@$(POSTGRES_HOST):$(POSTGRES_PORT)/$(POSTGRES_DB)?sslmode=disable" up

migrate-down:
	@docker run --rm --network host -v $(PWD)/alembic/versions:/migrations migrate/migrate -path=/migrations -database "postgres://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@$(POSTGRES_HOST):$(POSTGRES_PORT)/$(POSTGRES_DB)?sslmode=disable" down 1

migrate-docker-up:
	@docker run --rm --network host -v $(PWD)/alembic/versions:/migrations migrate/migrate -path=/migrations -database "postgres://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@$(POSTGRES_HOST):$(POSTGRES_PORT)/$(POSTGRES_DB)?sslmode=require" up

migrate-docker-down:
	@docker run --rm --network host -v $(PWD)/alembic/versions:/migrations migrate/migrate -path=/migrations -database "postgres://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@$(POSTGRES_HOST):$(POSTGRES_PORT)/$(POSTGRES_DB)?sslmode=require" down 1

docker:
	@docker compose -f $(COMPOSE_FILE) up --build

docker-test:
	@docker compose -f $(COMPOSE_FILE) up -d --build backend && docker compose -f $(COMPOSE_FILE) exec backend pytest -v tests

docker-down:
	@docker compose -f $(COMPOSE_FILE) down --rmi all --volumes --remove-orphans

docker-cache:
	@docker builder prune -f
