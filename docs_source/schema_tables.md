# Database Schema Documentation

## Schema Summary

| Schema | Tables |
|---|---:|
| net | 2 |
| auth | 23 |
| cron | 2 |
| vault | 1 |
| public | 73 |
| storage | 8 |
| realtime | 2 |

# NET Schema

## _http_response
**Columns:** 8

| Column | Type | Not Null | Default |
|---|---|---|---|
| content | text | No | None |
| content_type | text | No | None |
| created | timestamp with time zone | Yes | now() |
| error_msg | text | No | None |
| headers | jsonb | No | None |
| id | bigint | No | None |
| status_code | integer | No | None |
| timed_out | boolean | No | None |

**Constraints**
- CHECK: 42600_42612_8_not_null

## http_request_queue
**Columns:** 6

| Column | Type | Not Null | Default |
|---|---|---|---|
| body | bytea | No | None |
| headers | jsonb | No | None |
| id | bigint | Yes | nextval('net.http_request_queue_id_seq'::regclass) |
| method | net.http_method | Yes | None |
| timeout_milliseconds | integer | Yes | None |
| url | text | Yes | None |

**Constraints**
- CHECK: 42600_42605_1_not_null
- CHECK: 42600_42605_2_not_null
- CHECK: 42600_42605_3_not_null
- CHECK: 42600_42605_6_not_null

# AUTH Schema

## audit_log_entries
**Columns:** 5

| Column | Type | Not Null | Default |
|---|---|---|---|
| created_at | timestamp with time zone | No | None |
| id | uuid | Yes | None |
| instance_id | uuid | No | None |
| ip_address | character varying(64) | Yes | ''::character varying |
| payload | json | No | None |

**Constraints**
- PRIMARY KEY: audit_log_entries_pkey
- CHECK: 16498_16529_2_not_null
- CHECK: 16498_16529_5_not_null

## custom_oauth_providers
**Columns:** 24

| Column | Type | Not Null | Default |
|---|---|---|---|
| acceptable_client_ids | text[] | Yes | '{}'::text[] |
| attribute_mapping | jsonb | Yes | '{}'::jsonb |
| authorization_params | jsonb | Yes | '{}'::jsonb |
| authorization_url | text | No | None |
| cached_discovery | jsonb | No | None |
| client_id | text | Yes | None |
| client_secret | text | Yes | None |
| created_at | timestamp with time zone | Yes | now() |
| discovery_cached_at | timestamp with time zone | No | None |
| discovery_url | text | No | None |
| email_optional | boolean | Yes | false |
| enabled | boolean | Yes | true |
| id | uuid | Yes | gen_random_uuid() |
| identifier | text | Yes | None |
| issuer | text | No | None |
| jwks_uri | text | No | None |
| name | text | Yes | None |
| pkce_enabled | boolean | Yes | true |
| provider_type | text | Yes | None |
| scopes | text[] | Yes | '{}'::text[] |
| skip_nonce_check | boolean | Yes | false |
| token_url | text | No | None |
| updated_at | timestamp with time zone | Yes | now() |
| userinfo_url | text | No | None |

**Constraints**
- CHECK: custom_oauth_providers_authorization_url_https
- CHECK: custom_oauth_providers_authorization_url_length
- CHECK: custom_oauth_providers_client_id_length
- CHECK: custom_oauth_providers_discovery_url_length
- CHECK: custom_oauth_providers_identifier_format
- UNIQUE: custom_oauth_providers_identifier_key
- CHECK: custom_oauth_providers_issuer_length
- CHECK: custom_oauth_providers_jwks_uri_https
- CHECK: custom_oauth_providers_jwks_uri_length
- CHECK: custom_oauth_providers_name_length
- CHECK: custom_oauth_providers_oauth2_requires_endpoints
- CHECK: custom_oauth_providers_oidc_discovery_url_https
- CHECK: custom_oauth_providers_oidc_issuer_https
- CHECK: custom_oauth_providers_oidc_requires_issuer
- PRIMARY KEY: custom_oauth_providers_pkey
- CHECK: custom_oauth_providers_provider_type_check
- CHECK: custom_oauth_providers_token_url_https
- CHECK: custom_oauth_providers_token_url_length
- CHECK: custom_oauth_providers_userinfo_url_https
- CHECK: custom_oauth_providers_userinfo_url_length

## flow_state
**Columns:** 17

| Column | Type | Not Null | Default |
|---|---|---|---|
| auth_code | text | No | None |
| auth_code_issued_at | timestamp with time zone | No | None |
| authentication_method | text | Yes | None |
| code_challenge | text | No | None |
| code_challenge_method | auth.code_challenge_method | No | None |
| created_at | timestamp with time zone | No | None |
| email_optional | boolean | Yes | false |
| id | uuid | Yes | None |
| invite_token | text | No | None |
| linking_target_id | uuid | No | None |
| oauth_client_state_id | uuid | No | None |
| provider_access_token | text | No | None |
| provider_refresh_token | text | No | None |
| provider_type | text | Yes | None |
| referrer | text | No | None |
| updated_at | timestamp with time zone | No | None |
| user_id | uuid | No | None |

**Constraints**
- PRIMARY KEY: flow_state_pkey
- CHECK: 16498_16883_1_not_null
- CHECK: 16498_16883_6_not_null
- CHECK: 16498_16883_11_not_null
- CHECK: 16498_16883_17_not_null

## identities
**Columns:** 9

| Column | Type | Not Null | Default |
|---|---|---|---|
| created_at | timestamp with time zone | No | None |
| email | text | No | lower((identity_data ->> 'email'::text)) |
| id | uuid | Yes | gen_random_uuid() |
| identity_data | jsonb | Yes | None |
| last_sign_in_at | timestamp with time zone | No | None |
| provider | text | Yes | None |
| provider_id | text | Yes | None |
| updated_at | timestamp with time zone | No | None |
| user_id | uuid | Yes | None |

**Constraints**
- PRIMARY KEY: identities_pkey
- UNIQUE: identities_provider_id_provider_unique
- UNIQUE: identities_provider_id_provider_unique
- FOREIGN KEY: identities_user_id_fkey
- CHECK: 16498_16681_1_not_null
- CHECK: 16498_16681_2_not_null
- CHECK: 16498_16681_3_not_null
- CHECK: 16498_16681_4_not_null
- CHECK: 16498_16681_9_not_null

## instances
**Columns:** 5

| Column | Type | Not Null | Default |
|---|---|---|---|
| created_at | timestamp with time zone | No | None |
| id | uuid | Yes | None |
| raw_base_config | text | No | None |
| updated_at | timestamp with time zone | No | None |
| uuid | uuid | No | None |

**Constraints**
- PRIMARY KEY: instances_pkey
- CHECK: 16498_16522_1_not_null

## mfa_amr_claims
**Columns:** 5

| Column | Type | Not Null | Default |
|---|---|---|---|
| authentication_method | text | Yes | None |
| created_at | timestamp with time zone | Yes | None |
| id | uuid | Yes | None |
| session_id | uuid | Yes | None |
| updated_at | timestamp with time zone | Yes | None |

**Constraints**
- PRIMARY KEY: amr_id_pk
- UNIQUE: mfa_amr_claims_session_id_authentication_method_pkey
- UNIQUE: mfa_amr_claims_session_id_authentication_method_pkey
- FOREIGN KEY: mfa_amr_claims_session_id_fkey
- CHECK: 16498_16770_1_not_null
- CHECK: 16498_16770_2_not_null
- CHECK: 16498_16770_3_not_null
- CHECK: 16498_16770_4_not_null
- CHECK: 16498_16770_5_not_null

## mfa_challenges
**Columns:** 7

| Column | Type | Not Null | Default |
|---|---|---|---|
| created_at | timestamp with time zone | Yes | None |
| factor_id | uuid | Yes | None |
| id | uuid | Yes | None |
| ip_address | inet | Yes | None |
| otp_code | text | No | None |
| verified_at | timestamp with time zone | No | None |
| web_authn_session_data | jsonb | No | None |

**Constraints**
- FOREIGN KEY: mfa_challenges_auth_factor_id_fkey
- PRIMARY KEY: mfa_challenges_pkey
- CHECK: 16498_16758_1_not_null
- CHECK: 16498_16758_2_not_null
- CHECK: 16498_16758_3_not_null
- CHECK: 16498_16758_5_not_null

## mfa_factors
**Columns:** 13

| Column | Type | Not Null | Default |
|---|---|---|---|
| created_at | timestamp with time zone | Yes | None |
| factor_type | auth.factor_type | Yes | None |
| friendly_name | text | No | None |
| id | uuid | Yes | None |
| last_challenged_at | timestamp with time zone | No | None |
| last_webauthn_challenge_data | jsonb | No | None |
| phone | text | No | None |
| secret | text | No | None |
| status | auth.factor_status | Yes | None |
| updated_at | timestamp with time zone | Yes | None |
| user_id | uuid | Yes | None |
| web_authn_aaguid | uuid | No | None |
| web_authn_credential | jsonb | No | None |

**Constraints**
- UNIQUE: mfa_factors_last_challenged_at_key
- PRIMARY KEY: mfa_factors_pkey
- FOREIGN KEY: mfa_factors_user_id_fkey
- CHECK: 16498_16745_1_not_null
- CHECK: 16498_16745_2_not_null
- CHECK: 16498_16745_4_not_null
- CHECK: 16498_16745_5_not_null
- CHECK: 16498_16745_6_not_null
- CHECK: 16498_16745_7_not_null

## oauth_authorizations
**Columns:** 17

| Column | Type | Not Null | Default |
|---|---|---|---|
| approved_at | timestamp with time zone | No | None |
| authorization_code | text | No | None |
| authorization_id | text | Yes | None |
| client_id | uuid | Yes | None |
| code_challenge | text | No | None |
| code_challenge_method | auth.code_challenge_method | No | None |
| created_at | timestamp with time zone | Yes | now() |
| expires_at | timestamp with time zone | Yes | (now() + '00:03:00'::interval) |
| id | uuid | Yes | None |
| nonce | text | No | None |
| redirect_uri | text | Yes | None |
| resource | text | No | None |
| response_type | auth.oauth_response_type | Yes | 'code'::auth.oauth_response_type |
| scope | text | Yes | None |
| state | text | No | None |
| status | auth.oauth_authorization_status | Yes | 'pending'::auth.oauth_authorization_status |
| user_id | uuid | No | None |

**Constraints**
- UNIQUE: oauth_authorizations_authorization_code_key
- CHECK: oauth_authorizations_authorization_code_length
- UNIQUE: oauth_authorizations_authorization_id_key
- FOREIGN KEY: oauth_authorizations_client_id_fkey
- CHECK: oauth_authorizations_code_challenge_length
- CHECK: oauth_authorizations_expires_at_future
- CHECK: oauth_authorizations_nonce_length
- PRIMARY KEY: oauth_authorizations_pkey
- CHECK: oauth_authorizations_redirect_uri_length
- CHECK: oauth_authorizations_resource_length
- CHECK: oauth_authorizations_scope_length
- CHECK: oauth_authorizations_state_length
- FOREIGN KEY: oauth_authorizations_user_id_fkey
- CHECK: 16498_16995_1_not_null
- CHECK: 16498_16995_2_not_null
- CHECK: 16498_16995_3_not_null
- CHECK: 16498_16995_5_not_null
- CHECK: 16498_16995_6_not_null
- CHECK: 16498_16995_11_not_null
- CHECK: 16498_16995_12_not_null

## oauth_client_states
**Columns:** 4

| Column | Type | Not Null | Default |
|---|---|---|---|
| code_verifier | text | No | None |
| created_at | timestamp with time zone | Yes | None |
| id | uuid | Yes | None |
| provider_type | text | Yes | None |

**Constraints**
- PRIMARY KEY: oauth_client_states_pkey
- CHECK: 16498_17068_1_not_null
- CHECK: 16498_17068_2_not_null
- CHECK: 16498_17068_4_not_null

## oauth_clients
**Columns:** 13

| Column | Type | Not Null | Default |
|---|---|---|---|
| client_name | text | No | None |
| client_secret_hash | text | No | None |
| client_type | auth.oauth_client_type | Yes | 'confidential'::auth.oauth_client_type |
| client_uri | text | No | None |
| created_at | timestamp with time zone | Yes | now() |
| deleted_at | timestamp with time zone | No | None |
| grant_types | text | Yes | None |
| id | uuid | Yes | None |
| logo_uri | text | No | None |
| redirect_uris | text | Yes | None |
| registration_type | auth.oauth_registration_type | Yes | None |
| token_endpoint_auth_method | text | Yes | None |
| updated_at | timestamp with time zone | Yes | now() |

**Constraints**
- CHECK: oauth_clients_client_name_length
- CHECK: oauth_clients_client_uri_length
- CHECK: oauth_clients_logo_uri_length
- PRIMARY KEY: oauth_clients_pkey
- CHECK: oauth_clients_token_endpoint_auth_method_check
- CHECK: 16498_16965_1_not_null
- CHECK: 16498_16965_4_not_null
- CHECK: 16498_16965_5_not_null
- CHECK: 16498_16965_6_not_null
- CHECK: 16498_16965_10_not_null
- CHECK: 16498_16965_11_not_null
- CHECK: 16498_16965_13_not_null
- CHECK: 16498_16965_14_not_null

## oauth_consents
**Columns:** 6

| Column | Type | Not Null | Default |
|---|---|---|---|
| client_id | uuid | Yes | None |
| granted_at | timestamp with time zone | Yes | now() |
| id | uuid | Yes | None |
| revoked_at | timestamp with time zone | No | None |
| scopes | text | Yes | None |
| user_id | uuid | Yes | None |

**Constraints**
- FOREIGN KEY: oauth_consents_client_id_fkey
- PRIMARY KEY: oauth_consents_pkey
- CHECK: oauth_consents_revoked_after_granted
- CHECK: oauth_consents_scopes_length
- CHECK: oauth_consents_scopes_not_empty
- UNIQUE: oauth_consents_user_client_unique
- UNIQUE: oauth_consents_user_client_unique
- FOREIGN KEY: oauth_consents_user_id_fkey
- CHECK: 16498_17028_1_not_null
- CHECK: 16498_17028_2_not_null
- CHECK: 16498_17028_3_not_null
- CHECK: 16498_17028_4_not_null
- CHECK: 16498_17028_5_not_null

## one_time_tokens
**Columns:** 7

| Column | Type | Not Null | Default |
|---|---|---|---|
| created_at | timestamp without time zone | Yes | now() |
| id | uuid | Yes | None |
| relates_to | text | Yes | None |
| token_hash | text | Yes | None |
| token_type | auth.one_time_token_type | Yes | None |
| updated_at | timestamp without time zone | Yes | now() |
| user_id | uuid | Yes | None |

**Constraints**
- PRIMARY KEY: one_time_tokens_pkey
- CHECK: one_time_tokens_token_hash_check
- FOREIGN KEY: one_time_tokens_user_id_fkey
- CHECK: 16498_16933_1_not_null
- CHECK: 16498_16933_2_not_null
- CHECK: 16498_16933_3_not_null
- CHECK: 16498_16933_4_not_null
- CHECK: 16498_16933_5_not_null
- CHECK: 16498_16933_6_not_null
- CHECK: 16498_16933_7_not_null

## refresh_tokens
**Columns:** 9

| Column | Type | Not Null | Default |
|---|---|---|---|
| created_at | timestamp with time zone | No | None |
| id | bigint | Yes | nextval('auth.refresh_tokens_id_seq'::regclass) |
| instance_id | uuid | No | None |
| parent | character varying(255) | No | None |
| revoked | boolean | No | None |
| session_id | uuid | No | None |
| token | character varying(255) | No | None |
| updated_at | timestamp with time zone | No | None |
| user_id | character varying(255) | No | None |

**Constraints**
- PRIMARY KEY: refresh_tokens_pkey
- FOREIGN KEY: refresh_tokens_session_id_fkey
- UNIQUE: refresh_tokens_token_unique
- CHECK: 16498_16511_2_not_null

## saml_providers
**Columns:** 9

| Column | Type | Not Null | Default |
|---|---|---|---|
| attribute_mapping | jsonb | No | None |
| created_at | timestamp with time zone | No | None |
| entity_id | text | Yes | None |
| id | uuid | Yes | None |
| metadata_url | text | No | None |
| metadata_xml | text | Yes | None |
| name_id_format | text | No | None |
| sso_provider_id | uuid | Yes | None |
| updated_at | timestamp with time zone | No | None |

**Constraints**
- CHECK: entity_id not empty
- CHECK: metadata_url not empty
- CHECK: metadata_xml not empty
- UNIQUE: saml_providers_entity_id_key
- PRIMARY KEY: saml_providers_pkey
- FOREIGN KEY: saml_providers_sso_provider_id_fkey
- CHECK: 16498_16812_1_not_null
- CHECK: 16498_16812_2_not_null
- CHECK: 16498_16812_3_not_null
- CHECK: 16498_16812_4_not_null

## saml_relay_states
**Columns:** 8

| Column | Type | Not Null | Default |
|---|---|---|---|
| created_at | timestamp with time zone | No | None |
| flow_state_id | uuid | No | None |
| for_email | text | No | None |
| id | uuid | Yes | None |
| redirect_to | text | No | None |
| request_id | text | Yes | None |
| sso_provider_id | uuid | Yes | None |
| updated_at | timestamp with time zone | No | None |

**Constraints**
- CHECK: request_id not empty
- FOREIGN KEY: saml_relay_states_flow_state_id_fkey
- PRIMARY KEY: saml_relay_states_pkey
- FOREIGN KEY: saml_relay_states_sso_provider_id_fkey
- CHECK: 16498_16830_1_not_null
- CHECK: 16498_16830_2_not_null
- CHECK: 16498_16830_3_not_null

## schema_migrations
**Columns:** 1

| Column | Type | Not Null | Default |
|---|---|---|---|
| version | character varying(255) | Yes | None |

## sessions
**Columns:** 15

| Column | Type | Not Null | Default |
|---|---|---|---|
| aal | auth.aal_level | No | None |
| created_at | timestamp with time zone | No | None |
| factor_id | uuid | No | None |
| id | uuid | Yes | None |
| ip | inet | No | None |
| not_after | timestamp with time zone | No | None |
| oauth_client_id | uuid | No | None |
| refresh_token_counter | bigint | No | None |
| refresh_token_hmac_key | text | No | None |
| refreshed_at | timestamp without time zone | No | None |
| scopes | text | No | None |
| tag | text | No | None |
| updated_at | timestamp with time zone | No | None |
| user_agent | text | No | None |
| user_id | uuid | Yes | None |

**Constraints**
- FOREIGN KEY: sessions_oauth_client_id_fkey
- PRIMARY KEY: sessions_pkey
- CHECK: sessions_scopes_length
- FOREIGN KEY: sessions_user_id_fkey
- CHECK: 16498_16711_1_not_null
- CHECK: 16498_16711_2_not_null

## sso_domains
**Columns:** 5

| Column | Type | Not Null | Default |
|---|---|---|---|
| created_at | timestamp with time zone | No | None |
| domain | text | Yes | None |
| id | uuid | Yes | None |
| sso_provider_id | uuid | Yes | None |
| updated_at | timestamp with time zone | No | None |

**Constraints**
- CHECK: domain not empty
- PRIMARY KEY: sso_domains_pkey
- FOREIGN KEY: sso_domains_sso_provider_id_fkey
- CHECK: 16498_16797_1_not_null
- CHECK: 16498_16797_2_not_null
- CHECK: 16498_16797_3_not_null

## sso_providers
**Columns:** 5

| Column | Type | Not Null | Default |
|---|---|---|---|
| created_at | timestamp with time zone | No | None |
| disabled | boolean | No | None |
| id | uuid | Yes | None |
| resource_id | text | No | None |
| updated_at | timestamp with time zone | No | None |

**Constraints**
- CHECK: resource_id not empty
- PRIMARY KEY: sso_providers_pkey
- CHECK: 16498_16788_1_not_null

## users
**Columns:** 35

| Column | Type | Not Null | Default |
|---|---|---|---|
| aud | character varying(255) | No | None |
| banned_until | timestamp with time zone | No | None |
| confirmation_sent_at | timestamp with time zone | No | None |
| confirmation_token | character varying(255) | No | None |
| confirmed_at | timestamp with time zone | No | LEAST(email_confirmed_at, phone_confirmed_at) |
| created_at | timestamp with time zone | No | None |
| deleted_at | timestamp with time zone | No | None |
| email | character varying(255) | No | None |
| email_change | character varying(255) | No | None |
| email_change_confirm_status | smallint | No | 0 |
| email_change_sent_at | timestamp with time zone | No | None |
| email_change_token_current | character varying(255) | No | ''::character varying |
| email_change_token_new | character varying(255) | No | None |
| email_confirmed_at | timestamp with time zone | No | None |
| encrypted_password | character varying(255) | No | None |
| id | uuid | Yes | None |
| instance_id | uuid | No | None |
| invited_at | timestamp with time zone | No | None |
| is_anonymous | boolean | Yes | false |
| is_sso_user | boolean | Yes | false |
| is_super_admin | boolean | No | None |
| last_sign_in_at | timestamp with time zone | No | None |
| phone | text | No | NULL::character varying |
| phone_change | text | No | ''::character varying |
| phone_change_sent_at | timestamp with time zone | No | None |
| phone_change_token | character varying(255) | No | ''::character varying |
| phone_confirmed_at | timestamp with time zone | No | None |
| raw_app_meta_data | jsonb | No | None |
| raw_user_meta_data | jsonb | No | None |
| reauthentication_sent_at | timestamp with time zone | No | None |
| reauthentication_token | character varying(255) | No | ''::character varying |
| recovery_sent_at | timestamp with time zone | No | None |
| recovery_token | character varying(255) | No | None |
| role | character varying(255) | No | None |
| updated_at | timestamp with time zone | No | None |

**Constraints**
- CHECK: users_email_change_confirm_status_check
- UNIQUE: users_phone_key
- PRIMARY KEY: users_pkey
- CHECK: 16498_16499_2_not_null
- CHECK: 16498_16499_33_not_null
- CHECK: 16498_16499_35_not_null

## webauthn_challenges
**Columns:** 6

| Column | Type | Not Null | Default |
|---|---|---|---|
| challenge_type | text | Yes | None |
| created_at | timestamp with time zone | Yes | now() |
| expires_at | timestamp with time zone | Yes | None |
| id | uuid | Yes | gen_random_uuid() |
| session_data | jsonb | Yes | None |
| user_id | uuid | No | None |

**Constraints**
- CHECK: webauthn_challenges_challenge_type_check
- PRIMARY KEY: webauthn_challenges_pkey
- FOREIGN KEY: webauthn_challenges_user_id_fkey
- CHECK: 16498_25527_1_not_null
- CHECK: 16498_25527_3_not_null
- CHECK: 16498_25527_4_not_null
- CHECK: 16498_25527_5_not_null
- CHECK: 16498_25527_6_not_null

## webauthn_credentials
**Columns:** 14

| Column | Type | Not Null | Default |
|---|---|---|---|
| aaguid | uuid | No | None |
| attestation_type | text | Yes | ''::text |
| backed_up | boolean | Yes | false |
| backup_eligible | boolean | Yes | false |
| created_at | timestamp with time zone | Yes | now() |
| credential_id | bytea | Yes | None |
| friendly_name | text | Yes | ''::text |
| id | uuid | Yes | gen_random_uuid() |
| last_used_at | timestamp with time zone | No | None |
| public_key | bytea | Yes | None |
| sign_count | bigint | Yes | 0 |
| transports | jsonb | Yes | '[]'::jsonb |
| updated_at | timestamp with time zone | Yes | now() |
| user_id | uuid | Yes | None |

**Constraints**
- PRIMARY KEY: webauthn_credentials_pkey
- FOREIGN KEY: webauthn_credentials_user_id_fkey
- CHECK: 16498_25504_1_not_null
- CHECK: 16498_25504_2_not_null
- CHECK: 16498_25504_3_not_null
- CHECK: 16498_25504_4_not_null
- CHECK: 16498_25504_5_not_null
- CHECK: 16498_25504_7_not_null
- CHECK: 16498_25504_8_not_null
- CHECK: 16498_25504_9_not_null
- CHECK: 16498_25504_10_not_null
- CHECK: 16498_25504_11_not_null
- CHECK: 16498_25504_12_not_null
- CHECK: 16498_25504_13_not_null

# CRON Schema

## job
**Columns:** 9

| Column | Type | Not Null | Default |
|---|---|---|---|
| active | boolean | Yes | true |
| command | text | Yes | None |
| database | text | Yes | current_database() |
| jobid | bigint | Yes | nextval('cron.jobid_seq'::regclass) |
| jobname | text | No | None |
| nodename | text | Yes | 'localhost'::text |
| nodeport | integer | Yes | inet_server_port() |
| schedule | text | Yes | None |
| username | text | Yes | CURRENT_USER |

## job_run_details
**Columns:** 10

| Column | Type | Not Null | Default |
|---|---|---|---|
| command | text | No | None |
| database | text | No | None |
| end_time | timestamp with time zone | No | None |
| job_pid | integer | No | None |
| jobid | bigint | No | None |
| return_message | text | No | None |
| runid | bigint | Yes | nextval('cron.runid_seq'::regclass) |
| start_time | timestamp with time zone | No | None |
| status | text | No | None |
| username | text | No | None |

**Constraints**
- PRIMARY KEY: job_run_details_pkey
- CHECK: 42543_42564_2_not_null

# VAULT Schema

## secrets
**Columns:** 8

| Column | Type | Not Null | Default |
|---|---|---|---|
| created_at | timestamp with time zone | Yes | CURRENT_TIMESTAMP |
| description | text | Yes | ''::text |
| id | uuid | Yes | gen_random_uuid() |
| key_id | uuid | No | None |
| name | text | No | None |
| nonce | bytea | No | vault._crypto_aead_det_noncegen() |
| secret | text | Yes | None |
| updated_at | timestamp with time zone | Yes | CURRENT_TIMESTAMP |

**Constraints**
- PRIMARY KEY: secrets_pkey
- CHECK: 16607_16612_1_not_null
- CHECK: 16607_16612_3_not_null
- CHECK: 16607_16612_4_not_null
- CHECK: 16607_16612_7_not_null
- CHECK: 16607_16612_8_not_null

# PUBLIC Schema

## ai_predictions
**Columns:** 17

| Column | Type | Not Null | Default |
|---|---|---|---|
| actual_outcome | text | No | None |
| actual_value | numeric | No | None |
| animal_id | uuid | No | None |
| confidence_score | numeric | No | None |
| cow_id | uuid | No | None |
| created_at | timestamp without time zone | No | now() |
| farm_id | uuid | No | None |
| id | uuid | Yes | gen_random_uuid() |
| model_name | text | No | None |
| model_version | text | No | None |
| plot_id | text | No | None |
| prediction_accurate | boolean | No | None |
| prediction_date | date | Yes | None |
| prediction_text | text | No | None |
| prediction_type | text | Yes | None |
| prediction_value | numeric | No | None |
| valid_until_date | date | No | None |

**Constraints**
- FOREIGN KEY: ai_predictions_animal_id_fkey
- FOREIGN KEY: ai_predictions_cow_id_fkey
- FOREIGN KEY: ai_predictions_farm_id_fkey
- PRIMARY KEY: ai_predictions_pkey
- CHECK: 2200_18185_1_not_null
- CHECK: 2200_18185_3_not_null
- CHECK: 2200_18185_10_not_null

## alerts
**Columns:** 15

| Column | Type | Not Null | Default |
|---|---|---|---|
| acknowledged_at | timestamp without time zone | No | None |
| alert_date | date | Yes | None |
| alert_priority | text | No | 'medium'::text |
| alert_type | text | Yes | None |
| animal_id | uuid | No | None |
| cow_id | uuid | No | None |
| created_at | timestamp without time zone | No | now() |
| delivery_channels | text[] | No | None |
| due_date | date | No | None |
| farm_id | uuid | Yes | None |
| id | uuid | Yes | gen_random_uuid() |
| message | text | Yes | None |
| plot_id | text | No | None |
| sent_at | timestamp without time zone | No | None |
| status | text | No | 'pending'::text |

**Constraints**
- FOREIGN KEY: alerts_animal_id_fkey
- FOREIGN KEY: alerts_cow_id_fkey
- FOREIGN KEY: alerts_farm_id_fkey
- PRIMARY KEY: alerts_pkey
- CHECK: 2200_18145_1_not_null
- CHECK: 2200_18145_2_not_null
- CHECK: 2200_18145_3_not_null
- CHECK: 2200_18145_5_not_null
- CHECK: 2200_18145_9_not_null

## api_request_logs
**Columns:** 9

| Column | Type | Not Null | Default |
|---|---|---|---|
| created_at | timestamp with time zone | No | now() |
| endpoint | text | Yes | None |
| error_message | text | No | None |
| farm_id | uuid | No | None |
| id | uuid | Yes | gen_random_uuid() |
| method | text | Yes | None |
| response_time_ms | integer | No | None |
| status_code | integer | No | None |
| user_id | uuid | No | None |

**Constraints**
- FOREIGN KEY: api_request_logs_farm_id_fkey
- PRIMARY KEY: api_request_logs_pkey
- FOREIGN KEY: api_request_logs_user_id_fkey
- CHECK: 2200_42459_1_not_null
- CHECK: 2200_42459_2_not_null
- CHECK: 2200_42459_3_not_null

## audit_logs
**Columns:** 10

| Column | Type | Not Null | Default |
|---|---|---|---|
| action | text | Yes | None |
| actor_id | uuid | No | None |
| created_at | timestamp with time zone | No | now() |
| details | jsonb | No | '{}'::jsonb |
| farm_id | uuid | No | None |
| id | uuid | Yes | gen_random_uuid() |
| ip_address | text | No | None |
| resource | text | Yes | None |
| resource_id | text | No | None |
| user_agent | text | No | None |

**Constraints**
- FOREIGN KEY: audit_logs_actor_id_fkey
- FOREIGN KEY: audit_logs_farm_id_fkey
- PRIMARY KEY: audit_logs_pkey
- CHECK: 2200_43144_1_not_null
- CHECK: 2200_43144_2_not_null
- CHECK: 2200_43144_5_not_null

## auth_phone_salts
**Columns:** 5

| Column | Type | Not Null | Default |
|---|---|---|---|
| created_at | timestamp with time zone | Yes | now() |
| migrated_at | timestamp with time zone | No | None |
| phone_number | text | Yes | None |
| salt | uuid | Yes | gen_random_uuid() |
| scheme | text | Yes | 'salted_hmac_v1'::text |

**Constraints**
- PRIMARY KEY: auth_phone_salts_pkey
- CHECK: 2200_43520_1_not_null
- CHECK: 2200_43520_2_not_null
- CHECK: 2200_43520_3_not_null
- CHECK: 2200_43520_4_not_null

## breeding_events
**Columns:** 12

| Column | Type | Not Null | Default |
|---|---|---|---|
| bull_code | text | No | None |
| cow_id | uuid | Yes | None |
| created_at | timestamp without time zone | No | now() |
| expected_calving_date | date | No | None |
| heat_date | date | No | None |
| id | uuid | Yes | gen_random_uuid() |
| notes | text | No | None |
| pregnancy_check_date | date | No | None |
| pregnancy_result | text | No | None |
| service_date | date | Yes | None |
| service_type | text | No | None |
| sire_breed | text | No | None |

**Constraints**
- FOREIGN KEY: breeding_events_cow_id_fkey
- PRIMARY KEY: breeding_events_pkey
- CHECK: 2200_17781_1_not_null
- CHECK: 2200_17781_2_not_null
- CHECK: 2200_17781_4_not_null

## business_events
**Columns:** 7

| Column | Type | Not Null | Default |
|---|---|---|---|
| created_at | timestamp with time zone | No | now() |
| data_json | jsonb | No | None |
| event_type | text | Yes | None |
| farm_id | uuid | Yes | None |
| id | uuid | Yes | gen_random_uuid() |
| severity | text | No | 'info'::text |
| user_id | uuid | Yes | None |

**Constraints**
- FOREIGN KEY: business_events_farm_id_fkey
- PRIMARY KEY: business_events_pkey
- FOREIGN KEY: business_events_user_id_fkey
- CHECK: 2200_42482_1_not_null
- CHECK: 2200_42482_2_not_null
- CHECK: 2200_42482_3_not_null
- CHECK: 2200_42482_4_not_null

## calves
**Columns:** 13

| Column | Type | Not Null | Default |
|---|---|---|---|
| birth_date | date | Yes | None |
| birth_weight | numeric | No | None |
| cow_id | uuid | No | None |
| created_at | timestamp without time zone | No | now() |
| dam_id | uuid | No | None |
| id | uuid | Yes | gen_random_uuid() |
| notes | text | No | None |
| sex | text | No | None |
| sire_code | text | No | None |
| status | text | No | 'alive'::text |
| vaccination_records | text | No | None |
| weaning_date | date | No | None |
| weaning_weight | numeric | No | None |

**Constraints**
- FOREIGN KEY: calves_cow_id_fkey
- FOREIGN KEY: calves_dam_id_fkey
- PRIMARY KEY: calves_pkey
- CHECK: 2200_17819_1_not_null
- CHECK: 2200_17819_3_not_null

## calving_records
**Columns:** 12

| Column | Type | Not Null | Default |
|---|---|---|---|
| breeding_event_id | uuid | No | None |
| calf_birth_weight | numeric | No | None |
| calf_id | uuid | No | None |
| calf_sex | text | No | None |
| calf_vigor | text | No | None |
| calving_date | date | Yes | None |
| complications | text | No | None |
| cow_id | uuid | Yes | None |
| created_at | timestamp without time zone | No | now() |
| delivery_type | text | No | None |
| id | uuid | Yes | gen_random_uuid() |
| notes | text | No | None |

**Constraints**
- FOREIGN KEY: calving_records_breeding_event_id_fkey
- FOREIGN KEY: calving_records_calf_id_fkey
- FOREIGN KEY: calving_records_cow_id_fkey
- PRIMARY KEY: calving_records_pkey
- CHECK: 2200_17795_1_not_null
- CHECK: 2200_17795_2_not_null
- CHECK: 2200_17795_4_not_null

## coffee_activities
**Columns:** 29

| Column | Type | Not Null | Default |
|---|---|---|---|
| activity_date | date | Yes | CURRENT_DATE |
| activity_type | text | Yes | None |
| application_method | text | No | None |
| area_covered_ha | numeric(8,4) | No | None |
| calendar_triggered | boolean | No | false |
| cost_inputs | numeric(10,2) | No | 0 |
| cost_labour | numeric(10,2) | No | 0 |
| created_at | timestamp with time zone | No | now() |
| days_worked | numeric(5,1) | No | None |
| dilution_rate | text | No | None |
| farm_id | uuid | Yes | None |
| fertilizer_type | text | No | None |
| id | uuid | Yes | gen_random_uuid() |
| labour_mode | text | No | None |
| litres_water | numeric(8,2) | No | None |
| notes | text | No | None |
| num_workers | integer | No | None |
| plot_id | uuid | No | None |
| product_name | text | No | None |
| pruning_type | text | No | None |
| quantity | numeric(10,2) | No | None |
| quantity_unit | text | No | None |
| rate_per_day | numeric(8,2) | No | None |
| spray_reason | text | No | None |
| spray_type | text | No | None |
| total_cost | numeric(10,2) | No | (COALESCE(cost_inputs, (0)::numeric) + COALESCE(cost_labour, |
| updated_at | timestamp with time zone | No | now() |
| weather_conditions | text | No | None |
| weeding_method | text | No | None |

**Constraints**
- CHECK: coffee_activities_activity_type_check
- CHECK: coffee_activities_application_method_check
- FOREIGN KEY: coffee_activities_farm_id_fkey
- CHECK: coffee_activities_fertilizer_type_check
- CHECK: coffee_activities_labour_mode_check
- PRIMARY KEY: coffee_activities_pkey
- FOREIGN KEY: coffee_activities_plot_id_fkey
- CHECK: coffee_activities_pruning_type_check
- CHECK: coffee_activities_quantity_unit_check
- CHECK: coffee_activities_spray_reason_check
- CHECK: coffee_activities_spray_type_check
- CHECK: coffee_activities_total_cost_check
- CHECK: coffee_activities_total_cost_check
- CHECK: coffee_activities_total_cost_check
- CHECK: coffee_activities_weather_conditions_check
- CHECK: coffee_activities_weeding_method_check
- CHECK: 2200_33548_1_not_null
- CHECK: 2200_33548_2_not_null
- CHECK: 2200_33548_4_not_null
- CHECK: 2200_33548_5_not_null

## coffee_calendar_regions
**Columns:** 6

| Column | Type | Not Null | Default |
|---|---|---|---|
| counties | text[] | Yes | None |
| id | uuid | Yes | gen_random_uuid() |
| month | integer | Yes | None |
| recommended_activities | jsonb | Yes | None |
| region_name | text | Yes | None |
| season_context | text | No | None |

**Constraints**
- CHECK: coffee_calendar_regions_month_check
- PRIMARY KEY: coffee_calendar_regions_pkey
- CHECK: 2200_33589_1_not_null
- CHECK: 2200_33589_2_not_null
- CHECK: 2200_33589_3_not_null
- CHECK: 2200_33589_4_not_null
- CHECK: 2200_33589_5_not_null

## coffee_disease_thresholds
**Columns:** 16

| Column | Type | Not Null | Default |
|---|---|---|---|
| action_count | numeric(5,2) | No | None |
| action_threshold | text | No | None |
| alternative_products | text[] | No | None |
| application_notes | text | No | None |
| created_at | timestamp with time zone | No | now() |
| disease_pest_type | text | Yes | None |
| emergency_count | numeric(5,2) | No | None |
| emergency_threshold | text | No | None |
| high_risk_months | integer[] | No | None |
| id | uuid | Yes | gen_random_uuid() |
| recommended_product | text | No | None |
| region_name | text | Yes | None |
| updated_at | timestamp with time zone | No | now() |
| watch_count | numeric(5,2) | No | None |
| watch_threshold | text | No | None |
| why_different | text | No | None |

**Constraints**
- PRIMARY KEY: coffee_disease_thresholds_pkey
- UNIQUE: coffee_disease_thresholds_region_name_disease_pest_type_key
- UNIQUE: coffee_disease_thresholds_region_name_disease_pest_type_key
- UNIQUE: coffee_disease_thresholds_region_name_disease_pest_type_key
- UNIQUE: coffee_disease_thresholds_region_name_disease_pest_type_key
- CHECK: 2200_34908_1_not_null
- CHECK: 2200_34908_2_not_null
- CHECK: 2200_34908_3_not_null

## coffee_eudr_compliance
**Columns:** 17

| Column | Type | Not Null | Default |
|---|---|---|---|
| afa_verification_date | date | No | None |
| afa_verified | boolean | No | false |
| assessment_date | date | Yes | CURRENT_DATE |
| compliance_status | text | No | 'pending'::text |
| created_at | timestamp with time zone | No | now() |
| deforestation_risk | boolean | No | false |
| evidence_photos | text[] | No | ARRAY[]::text[] |
| farm_id | uuid | Yes | None |
| forest_cover_pct | numeric | No | None |
| id | uuid | Yes | gen_random_uuid() |
| land_use_before_2020 | text | No | None |
| last_forest_change_year | integer | No | None |
| notes | text | No | None |
| plot_id | uuid | Yes | None |
| raw_api_response | jsonb | No | None |
| risk_level | text | No | 'unknown'::text |
| updated_at | timestamp with time zone | No | now() |

**Constraints**
- CHECK: coffee_eudr_compliance_compliance_status_check
- FOREIGN KEY: coffee_eudr_compliance_farm_id_fkey
- PRIMARY KEY: coffee_eudr_compliance_pkey
- FOREIGN KEY: coffee_eudr_compliance_plot_id_fkey
- CHECK: coffee_eudr_compliance_risk_level_check
- CHECK: 2200_42282_1_not_null
- CHECK: 2200_42282_2_not_null
- CHECK: 2200_42282_3_not_null
- CHECK: 2200_42282_4_not_null

## coffee_financials
**Columns:** 13

| Column | Type | Not Null | Default |
|---|---|---|---|
| amount | numeric | Yes | None |
| buyer_name | text | No | None |
| category | text | Yes | None |
| cooperative_name | text | No | None |
| created_at | timestamp without time zone | No | now() |
| description | text | No | None |
| farm_id | uuid | Yes | None |
| id | uuid | Yes | gen_random_uuid() |
| notes | text | No | None |
| payment_method | text | No | None |
| plot_id | text | No | None |
| transaction_date | date | Yes | None |
| transaction_ref | text | No | None |

**Constraints**
- FOREIGN KEY: coffee_financials_farm_id_fkey
- PRIMARY KEY: coffee_financials_pkey
- CHECK: 2200_17951_1_not_null
- CHECK: 2200_17951_2_not_null
- CHECK: 2200_17951_3_not_null
- CHECK: 2200_17951_4_not_null
- CHECK: 2200_17951_6_not_null

## coffee_harvests
**Columns:** 29

| Column | Type | Not Null | Default |
|---|---|---|---|
| amount_paid | numeric | No | None |
| buyer_name | text | No | None |
| cherry_condition | text | No | None |
| cherry_kg | numeric | Yes | None |
| clean_coffee_kg | numeric | No | None |
| cooperative_name | text | No | None |
| created_at | timestamp without time zone | No | now() |
| factory_code | text | No | None |
| farm_id | uuid | Yes | None |
| harvest_date | date | Yes | None |
| harvest_season | text | No | None |
| harvest_year | integer | No | None |
| id | uuid | Yes | gen_random_uuid() |
| lot_number | text | No | None |
| mbuni_accepted | boolean | No | true |
| mbuni_rejection_reason | text | No | None |
| nce_transaction_id | text | No | None |
| notes | text | No | None |
| parchment_kg | numeric | No | None |
| payment_date | date | No | None |
| payment_status | text | No | 'pending'::text |
| plot_name | text | Yes | None |
| price_per_kg | numeric | No | None |
| processing_method | text | No | 'Wet/Washed'::text |
| produce_kg | numeric(10,2) | Yes | None |
| produce_type | text | No | 'cherry'::text |
| quality_grade | text | No | None |
| receipt_number | text | No | None |
| total_value | numeric | No | None |

**Constraints**
- CHECK: chk_plot_name_not_empty
- FOREIGN KEY: coffee_harvests_farm_id_fkey
- CHECK: coffee_harvests_payment_status_check
- PRIMARY KEY: coffee_harvests_pkey
- CHECK: coffee_harvests_produce_type_check
- CHECK: 2200_17905_1_not_null
- CHECK: 2200_17905_2_not_null
- CHECK: 2200_17905_3_not_null
- CHECK: 2200_17905_4_not_null
- CHECK: 2200_17905_7_not_null
- CHECK: 2200_17905_25_not_null

## coffee_health_records
**Columns:** 21

| Column | Type | Not Null | Default |
|---|---|---|---|
| ai_confidence_score | numeric | No | None |
| ai_diagnosis | text | No | None |
| antestia_bugs_severity | text | No | None |
| application_method | text | No | None |
| bacterial_blight_present | boolean | No | false |
| berry_borers_present | boolean | No | false |
| berry_photo_url | text | No | None |
| chemical_name | text | No | None |
| chemical_quantity | text | No | None |
| coffee_berry_disease_severity | text | No | None |
| coffee_leaf_rust_severity | text | No | None |
| cost | numeric | No | None |
| created_at | timestamp without time zone | No | now() |
| farm_id | uuid | Yes | None |
| id | uuid | Yes | gen_random_uuid() |
| inspection_date | date | Yes | None |
| leaf_photo_url | text | No | None |
| notes | text | No | None |
| plot_id | text | Yes | None |
| stem_borers_present | boolean | No | false |
| treatment_applied | text | No | None |

**Constraints**
- FOREIGN KEY: coffee_health_records_farm_id_fkey
- PRIMARY KEY: coffee_health_records_pkey
- CHECK: 2200_17920_1_not_null
- CHECK: 2200_17920_2_not_null
- CHECK: 2200_17920_3_not_null
- CHECK: 2200_17920_4_not_null

## coffee_inputs
**Columns:** 17

| Column | Type | Not Null | Default |
|---|---|---|---|
| created_at | timestamp without time zone | No | now() |
| farm_id | uuid | Yes | None |
| fertilizer_type | text | No | None |
| id | uuid | Yes | gen_random_uuid() |
| input_date | date | Yes | None |
| input_type | text | Yes | None |
| labor_cost | numeric | No | None |
| labor_hours | numeric | No | None |
| labor_type | text | No | None |
| notes | text | No | None |
| number_of_workers | integer | No | None |
| plot_applied | text | No | None |
| quantity_kg | numeric | No | None |
| supplier_name | text | No | None |
| total_cost | numeric | No | None |
| trees_treated | integer | No | None |
| unit_cost | numeric | No | None |

**Constraints**
- FOREIGN KEY: coffee_inputs_farm_id_fkey
- PRIMARY KEY: coffee_inputs_pkey
- CHECK: 2200_17937_1_not_null
- CHECK: 2200_17937_2_not_null
- CHECK: 2200_17937_3_not_null
- CHECK: 2200_17937_4_not_null

## coffee_passports
**Columns:** 14

| Column | Type | Not Null | Default |
|---|---|---|---|
| cooperative_id | uuid | No | None |
| created_at | timestamp with time zone | No | now() |
| export_lot_id | uuid | No | None |
| geo_summary | jsonb | No | '{}'::jsonb |
| id | uuid | Yes | gen_random_uuid() |
| passport_code | text | Yes | None |
| public_story | jsonb | Yes | '{}'::jsonb |
| published_at | timestamp with time zone | No | None |
| qr_url | text | No | None |
| quality_metrics | jsonb | No | '{}'::jsonb |
| status | text | No | 'draft'::text |
| sustainability_metrics | jsonb | No | '{}'::jsonb |
| updated_at | timestamp with time zone | No | now() |
| view_count | integer | No | 0 |

**Constraints**
- FOREIGN KEY: coffee_passports_cooperative_id_fkey
- FOREIGN KEY: coffee_passports_export_lot_id_fkey
- UNIQUE: coffee_passports_passport_code_key
- PRIMARY KEY: coffee_passports_pkey
- CHECK: coffee_passports_status_check
- CHECK: 2200_43644_1_not_null
- CHECK: 2200_43644_4_not_null
- CHECK: 2200_43644_7_not_null

## coffee_pest_library
**Columns:** 22

| Column | Type | Not Null | Default |
|---|---|---|---|
| affected_plant_parts | text[] | No | None |
| category | text | Yes | None |
| chemical_control | text | No | None |
| common_name_english | text | Yes | None |
| common_name_swahili | text | No | None |
| created_at | timestamp with time zone | No | now() |
| cultural_control | text | No | None |
| early_stage_symptoms | text | No | None |
| high_risk_conditions | text | No | None |
| id | uuid | Yes | gen_random_uuid() |
| late_stage_symptoms | text | No | None |
| organic_control | text | No | None |
| pest_disease_code | text | Yes | None |
| photo_urls | text[] | No | None |
| prevention_tips | text | No | None |
| quality_impact | text | No | None |
| registered_products | text[] | No | None |
| scientific_name | text | No | None |
| symptoms_description | text | No | None |
| updated_at | timestamp with time zone | No | now() |
| video_url | text | No | None |
| yield_loss_potential | text | No | None |

**Constraints**
- CHECK: coffee_pest_library_category_check
- UNIQUE: coffee_pest_library_pest_disease_code_key
- PRIMARY KEY: coffee_pest_library_pkey
- CHECK: 2200_34923_1_not_null
- CHECK: 2200_34923_2_not_null
- CHECK: 2200_34923_3_not_null
- CHECK: 2200_34923_6_not_null

## coffee_plants
**Columns:** 19

| Column | Type | Not Null | Default |
|---|---|---|---|
| age_years | numeric | No | None |
| created_at | timestamp without time zone | No | now() |
| deforestation_risk_status | text | No | None |
| eudr_compliant | boolean | No | false |
| farm_id | uuid | Yes | None |
| forest_cover_certification | text | No | None |
| gps_latitude | numeric(10,8) | No | None |
| gps_longitude | numeric(11,8) | No | None |
| id | uuid | Yes | gen_random_uuid() |
| land_ownership_doc_url | text | No | None |
| notes | text | No | None |
| plant_spacing_meters | numeric | No | None |
| plant_status | text | No | 'productive'::text |
| plant_tag | text | No | None |
| planting_date | date | No | None |
| plot_id | text | Yes | None |
| qr_code | text | No | None |
| updated_at | timestamp without time zone | No | now() |
| variety | text | No | None |

**Constraints**
- FOREIGN KEY: coffee_plants_farm_id_fkey
- PRIMARY KEY: coffee_plants_pkey
- UNIQUE: coffee_plants_qr_code_key
- CHECK: 2200_17886_1_not_null
- CHECK: 2200_17886_2_not_null
- CHECK: 2200_17886_5_not_null

## coffee_plot_weather
**Columns:** 15

| Column | Type | Not Null | Default |
|---|---|---|---|
| cbd_risk_score | integer | No | None |
| clr_risk_score | integer | No | None |
| created_at | timestamp with time zone | No | now() |
| date | date | Yes | None |
| drought_stress_score | integer | No | None |
| evapotranspiration | numeric(6,3) | No | None |
| id | uuid | Yes | gen_random_uuid() |
| plot_id | uuid | Yes | None |
| precipitation_sum | numeric(6,2) | No | None |
| relative_humidity_2m_mean | numeric(5,2) | No | None |
| soil_moisture_0_to_10cm | numeric(6,3) | No | None |
| temperature_2m_max | numeric(5,2) | No | None |
| temperature_2m_mean | numeric(5,2) | No | None |
| temperature_2m_min | numeric(5,2) | No | None |
| weather_code | integer | No | None |

**Constraints**
- CHECK: coffee_plot_weather_cbd_risk_score_check
- CHECK: coffee_plot_weather_clr_risk_score_check
- CHECK: coffee_plot_weather_drought_stress_score_check
- PRIMARY KEY: coffee_plot_weather_pkey
- UNIQUE: coffee_plot_weather_plot_id_date_key
- UNIQUE: coffee_plot_weather_plot_id_date_key
- UNIQUE: coffee_plot_weather_plot_id_date_key
- UNIQUE: coffee_plot_weather_plot_id_date_key
- FOREIGN KEY: coffee_plot_weather_plot_id_fkey
- CHECK: 2200_43202_1_not_null
- CHECK: 2200_43202_2_not_null
- CHECK: 2200_43202_3_not_null

## coffee_plots
**Columns:** 27

| Column | Type | Not Null | Default |
|---|---|---|---|
| afa_geo_mapping_id | text | No | None |
| age_years | integer | No | 0 |
| area_hectares | numeric(8,4) | No | None |
| created_at | timestamp with time zone | No | now() |
| establishment_year | integer | No | None |
| eudr_risk_assessed_at | timestamp with time zone | No | None |
| eudr_risk_details | text | No | None |
| eudr_risk_level | text | No | None |
| farm_id | uuid | Yes | None |
| gps_latitude | numeric(10,6) | No | None |
| gps_longitude | numeric(10,6) | No | None |
| gps_polygon | jsonb | No | None |
| id | uuid | Yes | gen_random_uuid() |
| land_ownership_doc_url | text | No | None |
| land_ownership_type | text | No | None |
| land_size_acres | numeric(10,2) | No | None |
| notes | text | No | None |
| plant_spacing_meters | numeric(4,2) | No | None |
| plant_status | text | No | 'productive'::text |
| planting_date | date | No | None |
| plot_code | text | No | None |
| plot_name | text | Yes | None |
| productive_trees | integer | No | 0 |
| region_name | text | No | None |
| total_trees | integer | Yes | 0 |
| updated_at | timestamp with time zone | No | now() |
| variety | text | No | None |

**Constraints**
- CHECK: coffee_plots_eudr_risk_level_check
- FOREIGN KEY: coffee_plots_farm_id_fkey
- CHECK: coffee_plots_land_ownership_type_check
- PRIMARY KEY: coffee_plots_pkey
- CHECK: coffee_plots_plant_status_check
- CHECK: 2200_33511_1_not_null
- CHECK: 2200_33511_2_not_null
- CHECK: 2200_33511_3_not_null
- CHECK: 2200_33511_8_not_null

## coffee_quality_records
**Columns:** 21

| Column | Type | Not Null | Default |
|---|---|---|---|
| acidity_score | numeric | No | None |
| aroma_score | numeric | No | None |
| blockchain_hash | text | No | None |
| body_score | numeric | No | None |
| created_at | timestamp without time zone | No | now() |
| cupper_name | text | No | None |
| cupping_date | date | No | None |
| cupping_score | numeric | No | None |
| export_ready_date | date | No | None |
| fair_trade_certified | boolean | No | false |
| flavor_notes | text | No | None |
| harvest_id | uuid | No | None |
| id | uuid | Yes | gen_random_uuid() |
| lot_number | text | No | None |
| milling_date | date | No | None |
| notes | text | No | None |
| organic_certified | boolean | No | false |
| processing_date | date | No | None |
| rainforest_alliance | boolean | No | false |
| traceability_url | text | No | None |
| utz_certified | boolean | No | false |

**Constraints**
- FOREIGN KEY: coffee_quality_records_harvest_id_fkey
- PRIMARY KEY: coffee_quality_records_pkey
- CHECK: 2200_17965_1_not_null

## coffee_satellite_fetch_log
**Columns:** 9

| Column | Type | Not Null | Default |
|---|---|---|---|
| cloud_cover_pct | numeric(5,2) | No | None |
| date_range_from | date | No | None |
| date_range_to | date | No | None |
| error_message | text | No | None |
| fetch_attempted_at | timestamp with time zone | No | now() |
| id | uuid | Yes | gen_random_uuid() |
| plot_id | uuid | Yes | None |
| processing_units_used | numeric(8,2) | No | None |
| status | text | Yes | None |

**Constraints**
- PRIMARY KEY: coffee_satellite_fetch_log_pkey
- FOREIGN KEY: coffee_satellite_fetch_log_plot_id_fkey
- CHECK: coffee_satellite_fetch_log_status_check
- CHECK: 2200_36115_1_not_null
- CHECK: 2200_36115_2_not_null
- CHECK: 2200_36115_4_not_null

## coffee_satellite_indices
**Columns:** 26

| Column | Type | Not Null | Default |
|---|---|---|---|
| acquired_at | timestamp with time zone | No | now() |
| alert_reason | text | No | None |
| alert_triggered | boolean | No | false |
| cloud_cover_pct | numeric(5,2) | No | None |
| created_at | timestamp with time zone | No | now() |
| farm_id | uuid | Yes | None |
| health_label | text | No | None |
| health_score | integer | No | None |
| health_score_change | integer | No | None |
| id | uuid | Yes | gen_random_uuid() |
| image_date | date | Yes | None |
| ndre_max | numeric(6,4) | No | None |
| ndre_mean | numeric(6,4) | No | None |
| ndre_min | numeric(6,4) | No | None |
| ndvi_change | numeric(6,4) | No | None |
| ndvi_max | numeric(6,4) | No | None |
| ndvi_mean | numeric(6,4) | No | None |
| ndvi_min | numeric(6,4) | No | None |
| ndvi_std | numeric(6,4) | No | None |
| ndwi_max | numeric(6,4) | No | None |
| ndwi_mean | numeric(6,4) | No | None |
| ndwi_min | numeric(6,4) | No | None |
| plot_id | uuid | Yes | None |
| raw_cdse_response | jsonb | No | None |
| sentinel_tile | text | No | None |
| weeks_of_decline | integer | No | 0 |

**Constraints**
- FOREIGN KEY: coffee_satellite_indices_farm_id_fkey
- CHECK: coffee_satellite_indices_health_label_check
- CHECK: coffee_satellite_indices_health_score_check
- PRIMARY KEY: coffee_satellite_indices_pkey
- FOREIGN KEY: coffee_satellite_indices_plot_id_fkey
- UNIQUE: coffee_satellite_indices_plot_id_image_date_key
- UNIQUE: coffee_satellite_indices_plot_id_image_date_key
- UNIQUE: coffee_satellite_indices_plot_id_image_date_key
- UNIQUE: coffee_satellite_indices_plot_id_image_date_key
- CHECK: 2200_36082_1_not_null
- CHECK: 2200_36082_2_not_null
- CHECK: 2200_36082_3_not_null
- CHECK: 2200_36082_4_not_null

## coffee_scouting_records
**Columns:** 27

| Column | Type | Not Null | Default |
|---|---|---|---|
| action_taken | text | No | None |
| alert_level | text | No | None |
| area_affected_ha | numeric(8,4) | No | None |
| cbd_green_berries_affected | integer | No | None |
| cbd_red_berries_affected | integer | No | None |
| cbd_yellow_berries_affected | integer | No | None |
| clr_defoliation_observed | boolean | No | None |
| clr_leaves_affected | integer | No | None |
| created_at | timestamp with time zone | No | now() |
| farm_id | uuid | Yes | None |
| id | uuid | Yes | gen_random_uuid() |
| notes | text | No | None |
| observation_type | text | Yes | None |
| percentage_plot_affected | numeric(5,2) | No | None |
| pest_count_per_tree | numeric(5,2) | No | 
CASE
    WHEN (trees_sampled > 0) THEN ((pest_count_total): |
| pest_count_total | integer | No | None |
| photo_urls | text[] | No | None |
| plot_id | uuid | Yes | None |
| scouted_by | text | No | None |
| scouting_date | date | Yes | CURRENT_DATE |
| severity_level | text | No | None |
| spray_activity_id | uuid | No | None |
| symptoms_description | text | No | None |
| threshold_breached | boolean | No | false |
| trees_sampled | integer | No | None |
| updated_at | timestamp with time zone | No | now() |
| weather_past_week | text | No | None |

**Constraints**
- CHECK: coffee_scouting_records_action_taken_check
- CHECK: coffee_scouting_records_alert_level_check
- FOREIGN KEY: coffee_scouting_records_farm_id_fkey
- CHECK: coffee_scouting_records_observation_type_check
- PRIMARY KEY: coffee_scouting_records_pkey
- FOREIGN KEY: coffee_scouting_records_plot_id_fkey
- CHECK: coffee_scouting_records_severity_level_check
- FOREIGN KEY: coffee_scouting_records_spray_activity_id_fkey
- CHECK: coffee_scouting_records_weather_past_week_check
- CHECK: 2200_34868_1_not_null
- CHECK: 2200_34868_2_not_null
- CHECK: 2200_34868_3_not_null
- CHECK: 2200_34868_4_not_null
- CHECK: 2200_34868_6_not_null

## compliance_audit_log
**Columns:** 9

| Column | Type | Not Null | Default |
|---|---|---|---|
| action | text | No | None |
| actor_id | uuid | No | None |
| actor_type | text | No | None |
| created_at | timestamp without time zone | No | now() |
| id | uuid | Yes | None |
| new_value | jsonb | No | None |
| notes | text | No | None |
| old_value | jsonb | No | None |
| plot_id | uuid | No | None |

**Constraints**
- PRIMARY KEY: compliance_audit_log_pkey
- CHECK: 2200_42326_1_not_null

## constituencies
**Columns:** 5

| Column | Type | Not Null | Default |
|---|---|---|---|
| county_id | text | Yes | None |
| created_at | timestamp without time zone | No | CURRENT_TIMESTAMP |
| id | text | Yes | None |
| name | character varying(255) | Yes | None |
| population_2009 | integer | No | None |

**Constraints**
- FOREIGN KEY: constituencies_county_id_fkey
- UNIQUE: constituencies_county_id_name_key
- UNIQUE: constituencies_county_id_name_key
- UNIQUE: constituencies_county_id_name_key
- UNIQUE: constituencies_county_id_name_key
- PRIMARY KEY: constituencies_pkey
- CHECK: 2200_40981_1_not_null
- CHECK: 2200_40981_2_not_null
- CHECK: 2200_40981_3_not_null

## coop_factories
**Columns:** 7

| Column | Type | Not Null | Default |
|---|---|---|---|
| branch_type | text | No | 'washing_station'::text |
| cooperative_id | uuid | Yes | None |
| created_at | timestamp with time zone | No | now() |
| factory_code | text | No | None |
| factory_name | text | Yes | None |
| id | uuid | Yes | gen_random_uuid() |
| updated_at | timestamp with time zone | No | now() |

**Constraints**
- FOREIGN KEY: coop_factories_cooperative_id_fkey
- PRIMARY KEY: coop_factories_pkey
- CHECK: 2200_43379_1_not_null
- CHECK: 2200_43379_2_not_null
- CHECK: 2200_43379_3_not_null

## cooperative_officers
**Columns:** 7

| Column | Type | Not Null | Default |
|---|---|---|---|
| cooperative_id | uuid | Yes | None |
| created_at | timestamp with time zone | No | now() |
| email | text | No | None |
| id | uuid | Yes | gen_random_uuid() |
| role | text | No | 'officer'::text |
| updated_at | timestamp with time zone | No | now() |
| user_id | uuid | Yes | None |

**Constraints**
- FOREIGN KEY: cooperative_officers_cooperative_id_fkey
- PRIMARY KEY: cooperative_officers_pkey
- UNIQUE: unique_coop_user
- UNIQUE: unique_coop_user
- UNIQUE: unique_coop_user
- UNIQUE: unique_coop_user
- CHECK: 2200_43395_1_not_null
- CHECK: 2200_43395_2_not_null
- CHECK: 2200_43395_3_not_null

## cooperatives
**Columns:** 9

| Column | Type | Not Null | Default |
|---|---|---|---|
| cooperative_name | text | Yes | None |
| county | text | Yes | None |
| created_at | timestamp with time zone | No | now() |
| email | text | No | None |
| id | uuid | Yes | gen_random_uuid() |
| primary_enterprise | text | Yes | None |
| sub_county | text | No | None |
| updated_at | timestamp with time zone | No | now() |
| ward | text | No | None |

**Constraints**
- PRIMARY KEY: cooperatives_pkey
- CHECK: 2200_43369_1_not_null
- CHECK: 2200_43369_2_not_null
- CHECK: 2200_43369_3_not_null
- CHECK: 2200_43369_6_not_null

## counties
**Columns:** 4

| Column | Type | Not Null | Default |
|---|---|---|---|
| created_at | timestamp without time zone | No | CURRENT_TIMESTAMP |
| id | text | Yes | None |
| name | character varying(255) | Yes | None |
| population_2009 | integer | No | None |

**Constraints**
- UNIQUE: counties_name_key
- PRIMARY KEY: counties_pkey
- CHECK: 2200_40971_1_not_null
- CHECK: 2200_40971_2_not_null

## cows
**Columns:** 21

| Column | Type | Not Null | Default |
|---|---|---|---|
| birth_date | date | No | None |
| breed | text | No | None |
| cow_tag | text | Yes | None |
| created_at | timestamp without time zone | No | now() |
| dam_id | uuid | No | None |
| exit_date | date | No | None |
| exit_reason | text | No | None |
| exit_value | numeric | No | None |
| farm_id | uuid | Yes | None |
| id | uuid | Yes | gen_random_uuid() |
| name | text | No | None |
| notes | text | No | None |
| purchase_date | date | No | None |
| purchase_price | numeric | No | None |
| purpose | text | No | 'dairy'::text |
| qr_code | text | No | None |
| sex | text | No | None |
| sire_id | uuid | No | None |
| source | text | No | None |
| status | text | No | 'active'::text |
| updated_at | timestamp without time zone | No | now() |

**Constraints**
- UNIQUE: cows_cow_tag_key
- FOREIGN KEY: cows_dam_id_fkey
- FOREIGN KEY: cows_farm_id_fkey
- PRIMARY KEY: cows_pkey
- UNIQUE: cows_qr_code_key
- FOREIGN KEY: cows_sire_id_fkey
- CHECK: 2200_17733_1_not_null
- CHECK: 2200_17733_2_not_null
- CHECK: 2200_17733_3_not_null

## error_events
**Columns:** 15

| Column | Type | Not Null | Default |
|---|---|---|---|
| context_json | jsonb | No | None |
| created_at | timestamp with time zone | No | now() |
| endpoint | text | No | None |
| farm_id | uuid | No | None |
| id | uuid | Yes | gen_random_uuid() |
| ip_address | text | No | None |
| message | text | Yes | None |
| method | text | No | None |
| request_id | uuid | No | None |
| response_time_ms | integer | No | None |
| severity | text | No | None |
| stack_trace | text | No | None |
| status_code | integer | No | None |
| user_agent | text | No | None |
| user_id | uuid | No | None |

**Constraints**
- FOREIGN KEY: error_events_farm_id_fkey
- PRIMARY KEY: error_events_pkey
- CHECK: error_events_severity_check
- FOREIGN KEY: error_events_user_id_fkey
- CHECK: 2200_42434_1_not_null
- CHECK: 2200_42434_2_not_null

## export_lot_mill_lots
**Columns:** 5

| Column | Type | Not Null | Default |
|---|---|---|---|
| clean_kg_allocated | numeric(10,2) | No | None |
| created_at | timestamp with time zone | No | now() |
| export_lot_id | uuid | Yes | None |
| id | uuid | Yes | gen_random_uuid() |
| mill_lot_id | uuid | Yes | None |

**Constraints**
- FOREIGN KEY: export_lot_mill_lots_export_lot_id_fkey
- UNIQUE: export_lot_mill_lots_export_lot_id_mill_lot_id_key
- UNIQUE: export_lot_mill_lots_export_lot_id_mill_lot_id_key
- UNIQUE: export_lot_mill_lots_export_lot_id_mill_lot_id_key
- UNIQUE: export_lot_mill_lots_export_lot_id_mill_lot_id_key
- FOREIGN KEY: export_lot_mill_lots_mill_lot_id_fkey
- PRIMARY KEY: export_lot_mill_lots_pkey
- CHECK: 2200_43625_1_not_null
- CHECK: 2200_43625_2_not_null
- CHECK: 2200_43625_3_not_null

## export_lots
**Columns:** 27

| Column | Type | Not Null | Default |
|---|---|---|---|
| arrival_date | date | No | None |
| bag_weight_kg | numeric(6,2) | No | 60 |
| bill_of_lading | text | No | None |
| buyer_country | text | No | None |
| buyer_name | text | No | None |
| container_number | text | No | None |
| cooperative_id | uuid | No | None |
| created_at | timestamp with time zone | No | now() |
| departure_date | date | No | None |
| destination_port | text | No | None |
| eudr_compliant | boolean | No | false |
| eudr_dds_reference | text | No | None |
| export_lot_number | text | Yes | None |
| exporter_name | text | No | None |
| fob_price_usd_per_kg | numeric(8,2) | No | None |
| grade | text | No | None |
| id | uuid | Yes | gen_random_uuid() |
| moisture_content_pct | numeric(5,2) | No | None |
| net_weight_kg | numeric(10,2) | No | None |
| notes | text | No | None |
| origin_port | text | No | 'Mombasa'::text |
| processing_method | text | No | 'washed'::text |
| sca_cupping_score | numeric(5,2) | No | None |
| status | text | No | 'pending'::text |
| total_bags | integer | No | None |
| total_value_usd | numeric(12,2) | No | None |
| updated_at | timestamp with time zone | No | now() |

**Constraints**
- FOREIGN KEY: export_lots_cooperative_id_fkey
- UNIQUE: export_lots_export_lot_number_key
- PRIMARY KEY: export_lots_pkey
- CHECK: export_lots_status_check
- CHECK: 2200_43602_1_not_null
- CHECK: 2200_43602_2_not_null

## factory_intake_lots
**Columns:** 18

| Column | Type | Not Null | Default |
|---|---|---|---|
| cooperative_id | uuid | No | None |
| created_at | timestamp with time zone | No | now() |
| dds_reference_number | text | No | None |
| factory_id | uuid | No | None |
| harvest_year | integer | No | None |
| id | uuid | Yes | gen_random_uuid() |
| intake_date | date | Yes | None |
| lot_number | text | Yes | None |
| nce_transaction_id | text | No | None |
| notes | text | No | None |
| outturn_ratio | numeric | No | None |
| parchment_kg | numeric | No | None |
| processing_start_date | date | No | None |
| qr_code_data | text | No | None |
| season | text | No | None |
| total_cherry_kg | numeric | No | None |
| total_farmers | integer | No | None |
| traceability_url | text | No | None |

**Constraints**
- FOREIGN KEY: factory_intake_lots_cooperative_id_fkey
- FOREIGN KEY: factory_intake_lots_factory_id_fkey
- UNIQUE: factory_intake_lots_lot_number_key
- PRIMARY KEY: factory_intake_lots_pkey
- CHECK: 2200_43469_1_not_null
- CHECK: 2200_43469_2_not_null
- CHECK: 2200_43469_5_not_null

## farm_events
**Columns:** 6

| Column | Type | Not Null | Default |
|---|---|---|---|
| created_at | timestamp without time zone | No | None |
| event_data | jsonb | No | None |
| event_type | text | No | None |
| farm_id | uuid | No | None |
| id | uuid | Yes | None |
| processed_at | timestamp without time zone | No | None |

**Constraints**
- PRIMARY KEY: farm_events_pkey
- CHECK: 2200_42317_1_not_null

## farm_managers
**Columns:** 4

| Column | Type | Not Null | Default |
|---|---|---|---|
| created_at | timestamp with time zone | No | now() |
| farm_id | uuid | Yes | None |
| role | text | No | None |
| user_id | uuid | Yes | None |

**Constraints**
- PRIMARY KEY: farm_managers_pkey
- PRIMARY KEY: farm_managers_pkey
- PRIMARY KEY: farm_managers_pkey
- PRIMARY KEY: farm_managers_pkey
- CHECK: 2200_22718_1_not_null
- CHECK: 2200_22718_2_not_null

## farm_type_configs
**Columns:** 12

| Column | Type | Not Null | Default |
|---|---|---|---|
| active_modules | text[] | No | '{}'::text[] |
| ai_diagnostics_enabled | boolean | No | true |
| alert_channels | text[] | No | '{whatsapp}'::text[] |
| alerts_enabled | boolean | No | true |
| created_at | timestamp without time zone | No | now() |
| farm_id | uuid | Yes | None |
| farm_type | text | Yes | None |
| id | uuid | Yes | gen_random_uuid() |
| language | text | No | 'english'::text |
| measurement_units | text | No | 'metric'::text |
| updated_at | timestamp without time zone | No | now() |
| voice_notes_enabled | boolean | No | false |

**Constraints**
- UNIQUE: farm_type_configs_farm_id_farm_type_key
- UNIQUE: farm_type_configs_farm_id_farm_type_key
- UNIQUE: farm_type_configs_farm_id_farm_type_key
- UNIQUE: farm_type_configs_farm_id_farm_type_key
- FOREIGN KEY: farm_type_configs_farm_id_fkey
- PRIMARY KEY: farm_type_configs_pkey
- CHECK: 2200_17709_1_not_null
- CHECK: 2200_17709_2_not_null
- CHECK: 2200_17709_3_not_null

## farms
**Columns:** 25

| Column | Type | Not Null | Default |
|---|---|---|---|
| claim_token | text | No | None |
| coop_factory_id | uuid | No | None |
| county | text | No | None |
| created_at | timestamp without time zone | No | now() |
| email | text | No | None |
| farm_name | text | Yes | None |
| farm_types | text[] | No | '{}'::text[] |
| gps_latitude | numeric(10,8) | No | None |
| gps_longitude | numeric(11,8) | No | None |
| id | uuid | Yes | gen_random_uuid() |
| is_active | boolean | No | true |
| is_coop_managed | boolean | No | false |
| land_size_acres | numeric | No | None |
| location | text | No | None |
| managed_by_coop_id | uuid | No | None |
| owner_name | text | Yes | None |
| phone | text | Yes | None |
| primary_enterprise | text | No | None |
| sub_county | text | No | None |
| subscription_end_date | date | No | None |
| subscription_start_date | date | No | None |
| subscription_tier | text | No | 'free'::text |
| updated_at | timestamp without time zone | No | now() |
| ward | text | No | None |
| whatsapp_language | text | No | 'en'::text |

**Constraints**
- UNIQUE: farms_claim_token_key
- FOREIGN KEY: farms_coop_factory_id_fkey
- FOREIGN KEY: farms_managed_by_coop_id_fkey
- PRIMARY KEY: farms_pkey
- CHECK: farms_subscription_tier_check
- CHECK: farms_whatsapp_language_check
- CHECK: 2200_17694_1_not_null
- CHECK: 2200_17694_2_not_null
- CHECK: 2200_17694_3_not_null
- CHECK: 2200_17694_4_not_null

## feed_records
**Columns:** 10

| Column | Type | Not Null | Default |
|---|---|---|---|
| animal_group | text | No | None |
| cost | numeric | No | None |
| created_at | timestamp without time zone | No | now() |
| farm_id | uuid | Yes | None |
| feed_type | text | No | None |
| id | uuid | Yes | gen_random_uuid() |
| notes | text | No | None |
| number_of_animals | integer | No | None |
| quantity_kg | numeric | No | None |
| record_date | date | Yes | None |

**Constraints**
- FOREIGN KEY: feed_records_farm_id_fkey
- PRIMARY KEY: feed_records_pkey
- CHECK: 2200_17853_1_not_null
- CHECK: 2200_17853_2_not_null
- CHECK: 2200_17853_3_not_null

## financial_records
**Columns:** 16

| Column | Type | Not Null | Default |
|---|---|---|---|
| amount | numeric | Yes | None |
| animal_id | uuid | No | None |
| category | text | Yes | None |
| cow_id | uuid | No | None |
| created_at | timestamp without time zone | No | now() |
| description | text | No | None |
| enterprise_type | text | No | None |
| farm_id | uuid | Yes | None |
| id | uuid | Yes | gen_random_uuid() |
| notes | text | No | None |
| payment_method | text | No | None |
| plot_id | text | No | None |
| receipt_url | text | No | None |
| subcategory | text | No | None |
| transaction_date | date | Yes | None |
| transaction_ref | text | No | None |

**Constraints**
- FOREIGN KEY: financial_records_animal_id_fkey
- FOREIGN KEY: financial_records_cow_id_fkey
- FOREIGN KEY: financial_records_farm_id_fkey
- PRIMARY KEY: financial_records_pkey
- CHECK: 2200_18121_1_not_null
- CHECK: 2200_18121_2_not_null
- CHECK: 2200_18121_3_not_null
- CHECK: 2200_18121_5_not_null
- CHECK: 2200_18121_8_not_null

## goat_milk_records
**Columns:** 12

| Column | Type | Not Null | Default |
|---|---|---|---|
| animal_id | uuid | Yes | None |
| created_at | timestamp without time zone | No | now() |
| days_in_milk | integer | No | None |
| evening_milk | numeric | No | None |
| id | uuid | Yes | gen_random_uuid() |
| lactation_number | integer | No | None |
| midday_milk | numeric | No | 0 |
| milk_quality | text | No | None |
| morning_milk | numeric | No | None |
| notes | text | No | None |
| record_date | date | Yes | None |
| total_milk | numeric | No | (COALESCE(morning_milk, (0)::numeric) + COALESCE(evening_mil |

**Constraints**
- FOREIGN KEY: goat_milk_records_animal_id_fkey
- UNIQUE: goat_milk_records_animal_id_record_date_key
- UNIQUE: goat_milk_records_animal_id_record_date_key
- UNIQUE: goat_milk_records_animal_id_record_date_key
- UNIQUE: goat_milk_records_animal_id_record_date_key
- PRIMARY KEY: goat_milk_records_pkey
- CHECK: 2200_18013_1_not_null
- CHECK: 2200_18013_2_not_null
- CHECK: 2200_18013_3_not_null

## health_records
**Columns:** 16

| Column | Type | Not Null | Default |
|---|---|---|---|
| cost | numeric | No | None |
| cow_id | uuid | Yes | None |
| created_at | timestamp without time zone | No | now() |
| disease | text | No | None |
| dosage | text | No | None |
| drug_name | text | No | None |
| id | uuid | Yes | gen_random_uuid() |
| notes | text | No | None |
| safe_meat_date | date | No | None |
| safe_milk_date | date | No | None |
| symptoms | text | No | None |
| treatment | text | No | None |
| treatment_date | date | Yes | None |
| vet_contact | text | No | None |
| vet_name | text | No | None |
| withdrawal_days | integer | No | None |

**Constraints**
- FOREIGN KEY: health_records_cow_id_fkey
- PRIMARY KEY: health_records_pkey
- CHECK: 2200_17839_1_not_null
- CHECK: 2200_17839_2_not_null
- CHECK: 2200_17839_3_not_null

## kidding_lambing_records
**Columns:** 15

| Column | Type | Not Null | Default |
|---|---|---|---|
| birth_weight | numeric | No | None |
| breeding_event_id | uuid | No | None |
| colostrum_given | boolean | No | None |
| colostrum_time | text | No | None |
| complications | text | No | None |
| created_at | timestamp without time zone | No | now() |
| dam_condition_post_delivery | text | No | None |
| dam_id | uuid | Yes | None |
| delivery_date | date | Yes | None |
| delivery_type | text | No | None |
| id | uuid | Yes | gen_random_uuid() |
| kid_lamb_id | uuid | No | None |
| notes | text | No | None |
| sex | text | No | None |
| vigor_score | text | No | None |

**Constraints**
- FOREIGN KEY: kidding_lambing_records_breeding_event_id_fkey
- FOREIGN KEY: kidding_lambing_records_dam_id_fkey
- FOREIGN KEY: kidding_lambing_records_kid_lamb_id_fkey
- PRIMARY KEY: kidding_lambing_records_pkey
- CHECK: 2200_18049_1_not_null
- CHECK: 2200_18049_2_not_null
- CHECK: 2200_18049_4_not_null

## lot_farmer_deliveries
**Columns:** 8

| Column | Type | Not Null | Default |
|---|---|---|---|
| created_at | timestamp with time zone | No | now() |
| delivery_date | date | No | None |
| farm_id | uuid | No | None |
| farmer_cherry_kg | numeric | No | None |
| harvest_id | uuid | No | None |
| id | uuid | Yes | gen_random_uuid() |
| lot_id | uuid | No | None |
| receipt_number | text | No | None |

**Constraints**
- FOREIGN KEY: lot_farmer_deliveries_farm_id_fkey
- FOREIGN KEY: lot_farmer_deliveries_harvest_id_fkey
- FOREIGN KEY: lot_farmer_deliveries_lot_id_fkey
- PRIMARY KEY: lot_farmer_deliveries_pkey
- CHECK: 2200_43490_1_not_null

## message_queue
**Columns:** 11

| Column | Type | Not Null | Default |
|---|---|---|---|
| attempts | integer | No | 0 |
| created_at | timestamp with time zone | No | now() |
| id | uuid | Yes | gen_random_uuid() |
| last_error | text | No | None |
| message_content | text | Yes | None |
| payload | jsonb | No | None |
| phone_number | text | Yes | None |
| processed_at | timestamp with time zone | No | None |
| retry_at | timestamp with time zone | No | None |
| source | text | Yes | None |
| status | text | Yes | 'pending'::text |

**Constraints**
- CHECK: check_attempts
- PRIMARY KEY: message_queue_pkey
- CHECK: message_queue_source_check
- CHECK: message_queue_status_check
- CHECK: 2200_42380_1_not_null
- CHECK: 2200_42380_2_not_null
- CHECK: 2200_42380_3_not_null
- CHECK: 2200_42380_4_not_null
- CHECK: 2200_42380_5_not_null

## message_results
**Columns:** 8

| Column | Type | Not Null | Default |
|---|---|---|---|
| created_at | timestamp with time zone | No | now() |
| execution_result | jsonb | No | None |
| farm_id | uuid | Yes | None |
| id | uuid | Yes | gen_random_uuid() |
| intent_payload | jsonb | No | None |
| intent_type | text | Yes | None |
| message_id | uuid | Yes | None |
| source | text | Yes | None |

**Constraints**
- FOREIGN KEY: fk_farm
- FOREIGN KEY: message_results_farm_id_fkey
- FOREIGN KEY: message_results_message_id_fkey
- PRIMARY KEY: message_results_pkey
- CHECK: 2200_42398_1_not_null
- CHECK: 2200_42398_2_not_null
- CHECK: 2200_42398_3_not_null
- CHECK: 2200_42398_4_not_null
- CHECK: 2200_42398_5_not_null

## milk_production
**Columns:** 16

| Column | Type | Not Null | Default |
|---|---|---|---|
| animal_id | uuid | Yes | None |
| created_at | timestamp with time zone | No | now() |
| days_in_milk | integer | No | None |
| evening_milk | numeric(5,2) | No | None |
| farm_id | uuid | Yes | None |
| fat_content | numeric(4,2) | No | None |
| id | uuid | Yes | gen_random_uuid() |
| lactation_number | integer | No | None |
| midday_milk | numeric(5,2) | No | None |
| milk_quality | text | No | None |
| morning_milk | numeric(5,2) | No | None |
| notes | text | No | None |
| record_date | date | Yes | None |
| temperature | numeric(4,1) | No | None |
| total_milk | numeric(5,2) | No | ((COALESCE(morning_milk, (0)::numeric) + COALESCE(midday_mil |
| updated_at | timestamp with time zone | No | now() |

**Constraints**
- CHECK: at_least_one_session
- CHECK: at_least_one_session
- CHECK: at_least_one_session
- FOREIGN KEY: milk_production_animal_id_fkey
- CHECK: milk_production_days_in_milk_check
- CHECK: milk_production_evening_milk_check
- FOREIGN KEY: milk_production_farm_id_fkey
- CHECK: milk_production_lactation_number_check
- CHECK: milk_production_midday_milk_check
- CHECK: milk_production_morning_milk_check
- PRIMARY KEY: milk_production_pkey
- UNIQUE: unique_animal_date
- UNIQUE: unique_animal_date
- UNIQUE: unique_animal_date
- UNIQUE: unique_animal_date
- CHECK: 2200_37473_1_not_null
- CHECK: 2200_37473_2_not_null
- CHECK: 2200_37473_3_not_null
- CHECK: 2200_37473_4_not_null

## milk_records
**Columns:** 12

| Column | Type | Not Null | Default |
|---|---|---|---|
| cow_id | uuid | Yes | None |
| created_at | timestamp without time zone | No | now() |
| days_in_milk | integer | No | None |
| evening_milk | numeric | No | None |
| id | uuid | Yes | gen_random_uuid() |
| lactation_number | integer | No | None |
| midday_milk | numeric | No | 0 |
| milk_quality | text | No | None |
| morning_milk | numeric | No | None |
| notes | text | No | None |
| record_date | date | Yes | None |
| total_milk | numeric | No | (COALESCE(morning_milk, (0)::numeric) + COALESCE(evening_mil |

**Constraints**
- FOREIGN KEY: milk_records_cow_id_fkey
- UNIQUE: milk_records_cow_id_record_date_key
- UNIQUE: milk_records_cow_id_record_date_key
- UNIQUE: milk_records_cow_id_record_date_key
- UNIQUE: milk_records_cow_id_record_date_key
- PRIMARY KEY: milk_records_pkey
- CHECK: 2200_17764_1_not_null
- CHECK: 2200_17764_2_not_null
- CHECK: 2200_17764_3_not_null

## mill_lot_batches
**Columns:** 5

| Column | Type | Not Null | Default |
|---|---|---|---|
| created_at | timestamp with time zone | No | now() |
| id | uuid | Yes | gen_random_uuid() |
| mill_lot_id | uuid | Yes | None |
| parchment_kg_contributed | numeric(10,2) | No | None |
| processing_batch_id | uuid | Yes | None |

**Constraints**
- FOREIGN KEY: mill_lot_batches_mill_lot_id_fkey
- UNIQUE: mill_lot_batches_mill_lot_id_processing_batch_id_key
- UNIQUE: mill_lot_batches_mill_lot_id_processing_batch_id_key
- UNIQUE: mill_lot_batches_mill_lot_id_processing_batch_id_key
- UNIQUE: mill_lot_batches_mill_lot_id_processing_batch_id_key
- PRIMARY KEY: mill_lot_batches_pkey
- FOREIGN KEY: mill_lot_batches_processing_batch_id_fkey
- CHECK: 2200_43583_1_not_null
- CHECK: 2200_43583_2_not_null
- CHECK: 2200_43583_3_not_null

## mill_lots
**Columns:** 17

| Column | Type | Not Null | Default |
|---|---|---|---|
| clean_coffee_kg_out | numeric(10,2) | No | None |
| cooperative_id | uuid | No | None |
| created_at | timestamp with time zone | No | now() |
| grade_breakdown | jsonb | No | None |
| id | uuid | Yes | gen_random_uuid() |
| mill_lot_number | text | Yes | None |
| mill_name | text | No | None |
| milling_date | date | No | None |
| milling_outturn_ratio | numeric(6,4) | No | None |
| moisture_content_pct | numeric(5,2) | No | None |
| nce_auction_date | date | No | None |
| nce_price_usd_per_kg | numeric(8,2) | No | None |
| nce_transaction_id | text | No | None |
| notes | text | No | None |
| status | text | No | 'pending'::text |
| total_parchment_kg_in | numeric(10,2) | No | None |
| updated_at | timestamp with time zone | No | now() |

**Constraints**
- FOREIGN KEY: mill_lots_cooperative_id_fkey
- UNIQUE: mill_lots_mill_lot_number_key
- PRIMARY KEY: mill_lots_pkey
- CHECK: mill_lots_status_check
- CHECK: 2200_43564_1_not_null
- CHECK: 2200_43564_2_not_null

## newsletter_subscribers
**Columns:** 5

| Column | Type | Not Null | Default |
|---|---|---|---|
| created_at | timestamp with time zone | No | now() |
| email | text | Yes | None |
| id | uuid | Yes | gen_random_uuid() |
| status | text | No | 'active'::text |
| subscribed_at | timestamp with time zone | No | now() |

**Constraints**
- UNIQUE: newsletter_subscribers_email_key
- PRIMARY KEY: newsletter_subscribers_pkey
- CHECK: 2200_43266_1_not_null
- CHECK: 2200_43266_2_not_null

## phone_otp_codes
**Columns:** 6

| Column | Type | Not Null | Default |
|---|---|---|---|
| created_at | timestamp with time zone | No | now() |
| expires_at | timestamp with time zone | Yes | None |
| id | uuid | Yes | gen_random_uuid() |
| metadata | jsonb | No | None |
| otp_code | text | Yes | None |
| phone_number | text | Yes | None |

**Constraints**
- UNIQUE: phone_otp_codes_phone_number_key
- PRIMARY KEY: phone_otp_codes_pkey
- CHECK: 2200_24372_1_not_null
- CHECK: 2200_24372_2_not_null
- CHECK: 2200_24372_3_not_null
- CHECK: 2200_24372_4_not_null

## poultry_batches
**Columns:** 19

| Column | Type | Not Null | Default |
|---|---|---|---|
| batch_name | text | Yes | None |
| bird_type | text | Yes | None |
| breed | text | No | None |
| closed_date | date | No | None |
| created_at | timestamp with time zone | Yes | now() |
| current_count | integer | Yes | None |
| date_of_placement | date | Yes | CURRENT_DATE |
| expected_laying_date | date | No | None |
| farm_id | uuid | Yes | None |
| house_number | text | No | None |
| housing_system | text | No | None |
| id | uuid | Yes | gen_random_uuid() |
| initial_count | integer | Yes | None |
| notes | text | No | None |
| purchase_price_per_bird | numeric(10,2) | No | None |
| source | text | No | None |
| status | text | Yes | 'active'::text |
| target_weight_kg | numeric(5,2) | No | None |
| updated_at | timestamp with time zone | Yes | now() |

**Constraints**
- CHECK: poultry_batches_bird_type_check
- CHECK: poultry_batches_current_count_check
- FOREIGN KEY: poultry_batches_farm_id_fkey
- CHECK: poultry_batches_initial_count_check
- PRIMARY KEY: poultry_batches_pkey
- CHECK: poultry_batches_status_check
- CHECK: 2200_42876_1_not_null
- CHECK: 2200_42876_2_not_null
- CHECK: 2200_42876_3_not_null
- CHECK: 2200_42876_4_not_null
- CHECK: 2200_42876_6_not_null
- CHECK: 2200_42876_7_not_null
- CHECK: 2200_42876_8_not_null
- CHECK: 2200_42876_15_not_null
- CHECK: 2200_42876_18_not_null
- CHECK: 2200_42876_19_not_null

## poultry_egg_records
**Columns:** 11

| Column | Type | Not Null | Default |
|---|---|---|---|
| batch_id | uuid | Yes | None |
| broken_eggs | integer | Yes | 0 |
| collected_eggs | integer | No | (total_eggs - broken_eggs) |
| created_at | timestamp with time zone | Yes | now() |
| grade_a | integer | No | 0 |
| grade_b | integer | No | 0 |
| grade_c | integer | No | 0 |
| id | uuid | Yes | gen_random_uuid() |
| notes | text | No | None |
| record_date | date | Yes | CURRENT_DATE |
| total_eggs | integer | Yes | None |

**Constraints**
- CHECK: broken_lte_total
- CHECK: broken_lte_total
- UNIQUE: poultry_egg_records_batch_date_key
- UNIQUE: poultry_egg_records_batch_date_key
- UNIQUE: poultry_egg_records_batch_date_key
- UNIQUE: poultry_egg_records_batch_date_key
- FOREIGN KEY: poultry_egg_records_batch_id_fkey
- CHECK: poultry_egg_records_broken_eggs_check
- PRIMARY KEY: poultry_egg_records_pkey
- CHECK: poultry_egg_records_total_eggs_check
- CHECK: 2200_42907_1_not_null
- CHECK: 2200_42907_2_not_null
- CHECK: 2200_42907_3_not_null
- CHECK: 2200_42907_4_not_null
- CHECK: 2200_42907_5_not_null
- CHECK: 2200_42907_11_not_null

## poultry_feed_records
**Columns:** 11

| Column | Type | Not Null | Default |
|---|---|---|---|
| batch_id | uuid | No | None |
| cost_per_kg | numeric(8,2) | Yes | 0 |
| created_at | timestamp with time zone | Yes | now() |
| days_remaining | integer | No | None |
| farm_id | uuid | Yes | None |
| feed_type | text | Yes | None |
| id | uuid | Yes | gen_random_uuid() |
| notes | text | No | None |
| quantity_kg | numeric(10,2) | Yes | None |
| record_date | date | Yes | CURRENT_DATE |
| total_cost | numeric(12,2) | Yes | 0 |

**Constraints**
- FOREIGN KEY: poultry_feed_records_batch_id_fkey
- FOREIGN KEY: poultry_feed_records_farm_id_fkey
- PRIMARY KEY: poultry_feed_records_pkey
- CHECK: poultry_feed_records_quantity_kg_check
- CHECK: 2200_42971_1_not_null
- CHECK: 2200_42971_2_not_null
- CHECK: 2200_42971_4_not_null
- CHECK: 2200_42971_5_not_null
- CHECK: 2200_42971_6_not_null
- CHECK: 2200_42971_7_not_null
- CHECK: 2200_42971_8_not_null
- CHECK: 2200_42971_11_not_null

## poultry_health_records
**Columns:** 19

| Column | Type | Not Null | Default |
|---|---|---|---|
| batch_id | uuid | Yes | None |
| cost | numeric(12,2) | No | None |
| created_at | timestamp with time zone | Yes | now() |
| disease | text | No | None |
| dosage | text | No | None |
| drug_name | text | No | None |
| event_date | date | Yes | CURRENT_DATE |
| event_type | text | Yes | None |
| farm_id | uuid | Yes | None |
| id | uuid | Yes | gen_random_uuid() |
| next_due_date | date | No | None |
| notes | text | No | None |
| safe_from_date | date | No | None |
| symptoms | text | No | None |
| vaccine_batch | text | No | None |
| vaccine_name | text | No | None |
| vet_contact | text | No | None |
| vet_name | text | No | None |
| withdrawal_days | integer | No | None |

**Constraints**
- FOREIGN KEY: poultry_health_records_batch_id_fkey
- CHECK: poultry_health_records_event_type_check
- FOREIGN KEY: poultry_health_records_farm_id_fkey
- PRIMARY KEY: poultry_health_records_pkey
- CHECK: 2200_42942_1_not_null
- CHECK: 2200_42942_2_not_null
- CHECK: 2200_42942_3_not_null
- CHECK: 2200_42942_4_not_null
- CHECK: 2200_42942_5_not_null
- CHECK: 2200_42942_19_not_null

## poultry_mortality
**Columns:** 10

| Column | Type | Not Null | Default |
|---|---|---|---|
| batch_id | uuid | Yes | None |
| cause | text | No | None |
| count_dead | integer | Yes | None |
| created_at | timestamp with time zone | Yes | now() |
| farm_id | uuid | Yes | None |
| id | uuid | Yes | gen_random_uuid() |
| notes | text | No | None |
| record_date | date | Yes | CURRENT_DATE |
| record_type | text | Yes | 'mortality'::text |
| symptoms | text | No | None |

**Constraints**
- FOREIGN KEY: poultry_mortality_batch_id_fkey
- CHECK: poultry_mortality_count_dead_check
- FOREIGN KEY: poultry_mortality_farm_id_fkey
- PRIMARY KEY: poultry_mortality_pkey
- CHECK: poultry_mortality_record_type_check
- CHECK: 2200_43001_1_not_null
- CHECK: 2200_43001_2_not_null
- CHECK: 2200_43001_3_not_null
- CHECK: 2200_43001_4_not_null
- CHECK: 2200_43001_5_not_null
- CHECK: 2200_43001_6_not_null
- CHECK: 2200_43001_10_not_null

## poultry_sales
**Columns:** 16

| Column | Type | Not Null | Default |
|---|---|---|---|
| batch_id | uuid | No | None |
| buyer_contact | text | No | None |
| buyer_name | text | No | None |
| created_at | timestamp with time zone | Yes | now() |
| farm_id | uuid | Yes | None |
| id | uuid | Yes | gen_random_uuid() |
| market | text | No | None |
| notes | text | No | None |
| payment_method | text | No | 'Cash'::text |
| payment_status | text | No | 'paid'::text |
| price_per_unit | numeric(10,2) | Yes | None |
| quantity | numeric(10,2) | Yes | None |
| sale_date | date | Yes | CURRENT_DATE |
| sale_type | text | Yes | None |
| total_price | numeric(12,2) | Yes | None |
| unit | text | Yes | None |

**Constraints**
- FOREIGN KEY: poultry_sales_batch_id_fkey
- FOREIGN KEY: poultry_sales_farm_id_fkey
- CHECK: poultry_sales_payment_status_check
- PRIMARY KEY: poultry_sales_pkey
- CHECK: poultry_sales_price_per_unit_check
- CHECK: poultry_sales_quantity_check
- CHECK: poultry_sales_sale_type_check
- CHECK: poultry_sales_total_price_check
- CHECK: 2200_43031_1_not_null
- CHECK: 2200_43031_2_not_null
- CHECK: 2200_43031_4_not_null
- CHECK: 2200_43031_5_not_null
- CHECK: 2200_43031_6_not_null
- CHECK: 2200_43031_7_not_null
- CHECK: 2200_43031_8_not_null
- CHECK: 2200_43031_9_not_null
- CHECK: 2200_43031_16_not_null

## processing_batches
**Columns:** 31

| Column | Type | Not Null | Default |
|---|---|---|---|
| batch_number | text | Yes | None |
| clerk_name | text | No | None |
| cooperative_id | uuid | No | None |
| created_at | timestamp with time zone | No | now() |
| drying_days | integer | No | None |
| drying_end_date | date | No | None |
| drying_method | text | No | 'raised_beds'::text |
| drying_start_date | date | No | None |
| factory_id | uuid | No | None |
| fermentation_end_time | timestamp with time zone | No | None |
| fermentation_hours | numeric(5,1) | No | None |
| fermentation_start_time | timestamp with time zone | No | None |
| fermentation_tank | text | No | None |
| harvest_year | integer | No | None |
| id | uuid | Yes | gen_random_uuid() |
| intake_date | date | Yes | None |
| intake_lot_id | uuid | No | None |
| moisture_content_pct | numeric(5,2) | No | None |
| notes | text | No | None |
| outturn_ratio | numeric(6,4) | No | None |
| parchment_kg | numeric(10,2) | No | None |
| pulping_start_time | timestamp with time zone | No | None |
| rejected_kg | numeric(10,2) | No | 0 |
| season | text | No | None |
| status | text | No | 'intake'::text |
| total_cherry_kg | numeric(10,2) | No | 0 |
| total_farmers | integer | No | 0 |
| total_mbuni_kg | numeric(10,2) | No | 0 |
| updated_at | timestamp with time zone | No | now() |
| washing_date | date | No | None |
| water_source | text | No | None |

**Constraints**
- UNIQUE: processing_batches_batch_number_key
- FOREIGN KEY: processing_batches_cooperative_id_fkey
- FOREIGN KEY: processing_batches_factory_id_fkey
- FOREIGN KEY: processing_batches_intake_lot_id_fkey
- PRIMARY KEY: processing_batches_pkey
- CHECK: processing_batches_status_check
- CHECK: 2200_43530_1_not_null
- CHECK: 2200_43530_2_not_null
- CHECK: 2200_43530_6_not_null

## rate_limits
**Columns:** 7

| Column | Type | Not Null | Default |
|---|---|---|---|
| created_at | timestamp with time zone | No | now() |
| endpoint | text | Yes | None |
| farm_id | uuid | No | None |
| id | bigint | Yes | nextval('rate_limits_id_seq'::regclass) |
| request_count | integer | No | 1 |
| reset_at | timestamp with time zone | Yes | None |
| user_id | uuid | No | None |

**Constraints**
- FOREIGN KEY: rate_limits_farm_id_fkey
- PRIMARY KEY: rate_limits_pkey
- FOREIGN KEY: rate_limits_user_id_fkey
- CHECK: 2200_42506_1_not_null
- CHECK: 2200_42506_4_not_null
- CHECK: 2200_42506_6_not_null

## small_ruminant_breeding
**Columns:** 18

| Column | Type | Not Null | Default |
|---|---|---|---|
| actual_delivery_date | date | No | None |
| complications | text | No | None |
| created_at | timestamp without time zone | No | now() |
| dam_id | uuid | Yes | None |
| delivery_type | text | No | None |
| expected_delivery_date | date | No | None |
| heat_date | date | No | None |
| id | uuid | Yes | gen_random_uuid() |
| notes | text | No | None |
| number_of_offspring | integer | No | None |
| offspring_ids | text[] | No | None |
| pregnancy_check_date | date | No | None |
| pregnancy_result | text | No | None |
| service_date | date | Yes | None |
| service_type | text | No | None |
| sire_breed | text | No | None |
| sire_id | uuid | No | None |
| sire_tag | text | No | None |

**Constraints**
- FOREIGN KEY: small_ruminant_breeding_dam_id_fkey
- PRIMARY KEY: small_ruminant_breeding_pkey
- FOREIGN KEY: small_ruminant_breeding_sire_id_fkey
- CHECK: 2200_18030_1_not_null
- CHECK: 2200_18030_2_not_null
- CHECK: 2200_18030_4_not_null

## small_ruminant_health
**Columns:** 20

| Column | Type | Not Null | Default |
|---|---|---|---|
| animal_id | uuid | Yes | None |
| cost | numeric | No | None |
| created_at | timestamp without time zone | No | now() |
| disease | text | No | None |
| dosage | text | No | None |
| drug_name | text | No | None |
| event_date | date | Yes | None |
| event_type | text | Yes | None |
| id | uuid | Yes | gen_random_uuid() |
| next_vaccination_due | date | No | None |
| notes | text | No | None |
| safe_consumption_date | date | No | None |
| symptoms | text | No | None |
| treatment | text | No | None |
| vaccine_batch_number | text | No | None |
| vaccine_name | text | No | None |
| vaccine_type | text | No | None |
| vet_contact | text | No | None |
| vet_name | text | No | None |
| withdrawal_days | integer | No | None |

**Constraints**
- FOREIGN KEY: small_ruminant_health_animal_id_fkey
- PRIMARY KEY: small_ruminant_health_pkey
- CHECK: 2200_18073_1_not_null
- CHECK: 2200_18073_2_not_null
- CHECK: 2200_18073_3_not_null
- CHECK: 2200_18073_4_not_null

## small_ruminant_sales
**Columns:** 18

| Column | Type | Not Null | Default |
|---|---|---|---|
| animal_id | uuid | No | None |
| buyer_contact | text | No | None |
| buyer_name | text | No | None |
| created_at | timestamp without time zone | No | now() |
| dressed_weight_kg | numeric | No | None |
| farm_id | uuid | Yes | None |
| id | uuid | Yes | gen_random_uuid() |
| live_weight_kg | numeric | No | None |
| market_location | text | No | None |
| milk_price_per_liter | numeric | No | None |
| milk_quantity_liters | numeric | No | None |
| notes | text | No | None |
| payment_method | text | No | None |
| payment_status | text | No | 'paid'::text |
| price_per_kg | numeric | No | None |
| sale_date | date | Yes | None |
| sale_type | text | Yes | None |
| total_price | numeric | Yes | None |

**Constraints**
- FOREIGN KEY: small_ruminant_sales_animal_id_fkey
- FOREIGN KEY: small_ruminant_sales_farm_id_fkey
- PRIMARY KEY: small_ruminant_sales_pkey
- CHECK: 2200_18101_1_not_null
- CHECK: 2200_18101_2_not_null
- CHECK: 2200_18101_4_not_null
- CHECK: 2200_18101_5_not_null
- CHECK: 2200_18101_11_not_null

## small_ruminants
**Columns:** 28

| Column | Type | Not Null | Default |
|---|---|---|---|
| animal_tag | text | Yes | None |
| birth_date | date | Yes | None |
| birth_weight | numeric | No | None |
| breed | text | No | None |
| breeding_type | text | No | None |
| coat_color | text | No | None |
| created_at | timestamp without time zone | No | now() |
| dam_id | uuid | No | None |
| distinguishing_marks | text | No | None |
| ear_notch_pattern | text | No | None |
| exit_date | date | No | None |
| exit_reason | text | No | None |
| exit_value | numeric | No | None |
| farm_id | uuid | Yes | None |
| id | uuid | Yes | gen_random_uuid() |
| name | text | No | None |
| notes | text | No | None |
| purchase_date | date | No | None |
| purchase_price | numeric | No | None |
| purpose | text | No | None |
| qr_code | text | No | None |
| sex | text | Yes | None |
| sire_id | uuid | No | None |
| source | text | No | None |
| species | text | Yes | None |
| status | text | No | 'active'::text |
| updated_at | timestamp without time zone | No | now() |
| upgrade_level | text | No | None |

**Constraints**
- UNIQUE: small_ruminants_animal_tag_key
- FOREIGN KEY: small_ruminants_dam_id_fkey
- FOREIGN KEY: small_ruminants_farm_id_fkey
- PRIMARY KEY: small_ruminants_pkey
- UNIQUE: small_ruminants_qr_code_key
- FOREIGN KEY: small_ruminants_sire_id_fkey
- CHECK: 2200_17983_1_not_null
- CHECK: 2200_17983_2_not_null
- CHECK: 2200_17983_3_not_null
- CHECK: 2200_17983_7_not_null
- CHECK: 2200_17983_10_not_null
- CHECK: 2200_17983_11_not_null

## traceability_events
**Columns:** 11

| Column | Type | Not Null | Default |
|---|---|---|---|
| actor_name | text | No | None |
| actor_user_id | uuid | No | None |
| cooperative_id | uuid | No | None |
| created_at | timestamp with time zone | No | now() |
| current_hash | text | Yes | None |
| entity_id | uuid | Yes | None |
| entity_type | text | Yes | None |
| event_data | jsonb | Yes | '{}'::jsonb |
| event_type | text | Yes | None |
| id | uuid | Yes | gen_random_uuid() |
| previous_hash | text | No | None |

**Constraints**
- FOREIGN KEY: traceability_events_cooperative_id_fkey
- PRIMARY KEY: traceability_events_pkey
- CHECK: 2200_43673_1_not_null
- CHECK: 2200_43673_2_not_null
- CHECK: 2200_43673_3_not_null
- CHECK: 2200_43673_7_not_null
- CHECK: 2200_43673_8_not_null
- CHECK: 2200_43673_10_not_null

## transactions
**Columns:** 13

| Column | Type | Not Null | Default |
|---|---|---|---|
| amount | numeric | Yes | None |
| checkout_request_id | text | Yes | None |
| created_at | timestamp with time zone | No | now() |
| farm_id | uuid | No | None |
| id | uuid | Yes | gen_random_uuid() |
| merchant_request_id | text | Yes | None |
| months_added | integer | Yes | 1 |
| mpesa_receipt_number | text | No | None |
| phone_number | text | Yes | None |
| result_desc | text | No | None |
| status | text | Yes | 'pending'::text |
| updated_at | timestamp with time zone | No | now() |
| user_id | uuid | No | None |

**Constraints**
- FOREIGN KEY: transactions_farm_id_fkey
- PRIMARY KEY: transactions_pkey
- FOREIGN KEY: transactions_user_id_fkey
- CHECK: 2200_42780_1_not_null
- CHECK: 2200_42780_4_not_null
- CHECK: 2200_42780_5_not_null
- CHECK: 2200_42780_6_not_null
- CHECK: 2200_42780_7_not_null
- CHECK: 2200_42780_8_not_null
- CHECK: 2200_42780_11_not_null

## vet_visits
**Columns:** 13

| Column | Type | Not Null | Default |
|---|---|---|---|
| cost | numeric | No | None |
| cow_id | uuid | No | None |
| created_at | timestamp without time zone | No | now() |
| diagnosis | text | No | None |
| farm_id | uuid | Yes | None |
| id | uuid | Yes | gen_random_uuid() |
| next_visit_date | date | No | None |
| notes | text | No | None |
| prescription | text | No | None |
| vet_contact | text | No | None |
| vet_name | text | Yes | None |
| visit_date | date | Yes | None |
| visit_reason | text | No | None |

**Constraints**
- FOREIGN KEY: vet_visits_cow_id_fkey
- FOREIGN KEY: vet_visits_farm_id_fkey
- PRIMARY KEY: vet_visits_pkey
- CHECK: 2200_17867_1_not_null
- CHECK: 2200_17867_2_not_null
- CHECK: 2200_17867_4_not_null
- CHECK: 2200_17867_5_not_null

## wards
**Columns:** 6

| Column | Type | Not Null | Default |
|---|---|---|---|
| constituency_id | text | Yes | None |
| created_at | timestamp without time zone | No | CURRENT_TIMESTAMP |
| id | text | Yes | None |
| name | character varying(255) | Yes | None |
| population_2009 | integer | No | None |
| ward_uid | character varying(50) | No | None |

**Constraints**
- FOREIGN KEY: wards_constituency_id_fkey
- UNIQUE: wards_constituency_id_name_key
- UNIQUE: wards_constituency_id_name_key
- UNIQUE: wards_constituency_id_name_key
- UNIQUE: wards_constituency_id_name_key
- PRIMARY KEY: wards_pkey
- CHECK: 2200_40996_1_not_null
- CHECK: 2200_40996_2_not_null
- CHECK: 2200_40996_3_not_null

## weight_records
**Columns:** 10

| Column | Type | Not Null | Default |
|---|---|---|---|
| age_days | integer | No | None |
| animal_id | uuid | Yes | None |
| average_daily_gain | numeric | No | None |
| body_condition_score | numeric | No | None |
| created_at | timestamp without time zone | No | now() |
| id | uuid | Yes | gen_random_uuid() |
| measurement_type | text | No | None |
| notes | text | No | None |
| record_date | date | Yes | None |
| weight_kg | numeric | Yes | None |

**Constraints**
- FOREIGN KEY: weight_records_animal_id_fkey
- PRIMARY KEY: weight_records_pkey
- CHECK: 2200_18087_1_not_null
- CHECK: 2200_18087_2_not_null
- CHECK: 2200_18087_3_not_null
- CHECK: 2200_18087_4_not_null

## whatsapp_messages
**Columns:** 15

| Column | Type | Not Null | Default |
|---|---|---|---|
| conversation_context | jsonb | No | None |
| created_at | timestamp without time zone | No | now() |
| entities_extracted | jsonb | No | None |
| farm_id | uuid | No | None |
| id | uuid | Yes | gen_random_uuid() |
| intent | text | No | None |
| intent_confidence | numeric | No | None |
| media_type | text | No | None |
| media_url | text | No | None |
| message_text | text | No | None |
| message_type | text | No | None |
| response_sent_at | timestamp without time zone | No | None |
| response_text | text | No | None |
| sender_phone | text | Yes | None |
| session_id | text | No | None |

**Constraints**
- FOREIGN KEY: whatsapp_messages_farm_id_fkey
- PRIMARY KEY: whatsapp_messages_pkey
- CHECK: 2200_18171_1_not_null
- CHECK: 2200_18171_3_not_null

# STORAGE Schema

## buckets
**Columns:** 11

| Column | Type | Not Null | Default |
|---|---|---|---|
| allowed_mime_types | text[] | No | None |
| avif_autodetection | boolean | No | false |
| created_at | timestamp with time zone | No | now() |
| file_size_limit | bigint | No | None |
| id | text | Yes | None |
| name | text | Yes | None |
| owner | uuid | No | None |
| owner_id | text | No | None |
| public | boolean | No | false |
| type | storage.buckettype | Yes | 'STANDARD'::storage.buckettype |
| updated_at | timestamp with time zone | No | now() |

**Constraints**
- PRIMARY KEY: buckets_pkey
- CHECK: 16546_17314_1_not_null
- CHECK: 16546_17314_2_not_null
- CHECK: 16546_17314_11_not_null

## buckets_analytics
**Columns:** 7

| Column | Type | Not Null | Default |
|---|---|---|---|
| created_at | timestamp with time zone | Yes | now() |
| deleted_at | timestamp with time zone | No | None |
| format | text | Yes | 'ICEBERG'::text |
| id | uuid | Yes | gen_random_uuid() |
| name | text | Yes | None |
| type | storage.buckettype | Yes | 'ANALYTICS'::storage.buckettype |
| updated_at | timestamp with time zone | Yes | now() |

**Constraints**
- PRIMARY KEY: buckets_analytics_pkey
- CHECK: 16546_17434_1_not_null
- CHECK: 16546_17434_2_not_null
- CHECK: 16546_17434_3_not_null
- CHECK: 16546_17434_4_not_null
- CHECK: 16546_17434_5_not_null
- CHECK: 16546_17434_6_not_null

## buckets_vectors
**Columns:** 4

| Column | Type | Not Null | Default |
|---|---|---|---|
| created_at | timestamp with time zone | Yes | now() |
| id | text | Yes | None |
| type | storage.buckettype | Yes | 'VECTOR'::storage.buckettype |
| updated_at | timestamp with time zone | Yes | now() |

## migrations
**Columns:** 4

| Column | Type | Not Null | Default |
|---|---|---|---|
| executed_at | timestamp without time zone | No | CURRENT_TIMESTAMP |
| hash | character varying(40) | Yes | None |
| id | integer | Yes | None |
| name | character varying(100) | Yes | None |

## objects
**Columns:** 12

| Column | Type | Not Null | Default |
|---|---|---|---|
| bucket_id | text | No | None |
| created_at | timestamp with time zone | No | now() |
| id | uuid | Yes | gen_random_uuid() |
| last_accessed_at | timestamp with time zone | No | now() |
| metadata | jsonb | No | None |
| name | text | No | None |
| owner | uuid | No | None |
| owner_id | text | No | None |
| path_tokens | text[] | No | string_to_array(name, '/'::text) |
| updated_at | timestamp with time zone | No | now() |
| user_metadata | jsonb | No | None |
| version | text | No | None |

**Constraints**
- FOREIGN KEY: objects_bucketId_fkey
- PRIMARY KEY: objects_pkey
- CHECK: 16546_17324_1_not_null

## s3_multipart_uploads
**Columns:** 10

| Column | Type | Not Null | Default |
|---|---|---|---|
| bucket_id | text | Yes | None |
| created_at | timestamp with time zone | Yes | now() |
| id | text | Yes | None |
| in_progress_size | bigint | Yes | 0 |
| key | text | Yes | None |
| metadata | jsonb | No | None |
| owner_id | text | No | None |
| upload_signature | text | Yes | None |
| user_metadata | jsonb | No | None |
| version | text | Yes | None |

**Constraints**
- FOREIGN KEY: s3_multipart_uploads_bucket_id_fkey
- PRIMARY KEY: s3_multipart_uploads_pkey
- CHECK: 16546_17373_1_not_null
- CHECK: 16546_17373_2_not_null
- CHECK: 16546_17373_3_not_null
- CHECK: 16546_17373_4_not_null
- CHECK: 16546_17373_5_not_null
- CHECK: 16546_17373_6_not_null
- CHECK: 16546_17373_8_not_null

## s3_multipart_uploads_parts
**Columns:** 10

| Column | Type | Not Null | Default |
|---|---|---|---|
| bucket_id | text | Yes | None |
| created_at | timestamp with time zone | Yes | now() |
| etag | text | Yes | None |
| id | uuid | Yes | gen_random_uuid() |
| key | text | Yes | None |
| owner_id | text | No | None |
| part_number | integer | Yes | None |
| size | bigint | Yes | 0 |
| upload_id | text | Yes | None |
| version | text | Yes | None |

**Constraints**
- FOREIGN KEY: s3_multipart_uploads_parts_bucket_id_fkey
- PRIMARY KEY: s3_multipart_uploads_parts_pkey
- FOREIGN KEY: s3_multipart_uploads_parts_upload_id_fkey
- CHECK: 16546_17387_1_not_null
- CHECK: 16546_17387_2_not_null
- CHECK: 16546_17387_3_not_null
- CHECK: 16546_17387_4_not_null
- CHECK: 16546_17387_5_not_null
- CHECK: 16546_17387_6_not_null
- CHECK: 16546_17387_7_not_null
- CHECK: 16546_17387_9_not_null
- CHECK: 16546_17387_10_not_null

## vector_indexes
**Columns:** 9

| Column | Type | Not Null | Default |
|---|---|---|---|
| bucket_id | text | Yes | None |
| created_at | timestamp with time zone | Yes | now() |
| data_type | text | Yes | None |
| dimension | integer | Yes | None |
| distance_metric | text | Yes | None |
| id | text | Yes | gen_random_uuid() |
| metadata_configuration | jsonb | No | None |
| name | text | Yes | None |
| updated_at | timestamp with time zone | Yes | now() |

# REALTIME Schema

## schema_migrations
**Columns:** 2

| Column | Type | Not Null | Default |
|---|---|---|---|
| inserted_at | timestamp(0) without time zone | No | None |
| version | bigint | Yes | None |

**Constraints**
- PRIMARY KEY: schema_migrations_pkey
- CHECK: 16559_17122_1_not_null

## subscription
**Columns:** 8

| Column | Type | Not Null | Default |
|---|---|---|---|
| action_filter | text | No | '*'::text |
| claims | jsonb | Yes | None |
| claims_role | regrole | Yes | realtime.to_regrole((claims ->> 'role'::text)) |
| created_at | timestamp without time zone | Yes | timezone('utc'::text, now()) |
| entity | regclass | Yes | None |
| filters | realtime.user_defined_filter[] | Yes | '{}'::realtime.user_defined_filter[] |
| id | bigint | Yes | None |
| subscription_id | uuid | Yes | None |

**Constraints**
- PRIMARY KEY: pk_subscription
- CHECK: subscription_action_filter_check
- CHECK: 16559_17145_1_not_null
- CHECK: 16559_17145_2_not_null
- CHECK: 16559_17145_4_not_null
- CHECK: 16559_17145_5_not_null
- CHECK: 16559_17145_7_not_null
- CHECK: 16559_17145_8_not_null
- CHECK: 16559_17145_9_not_null
