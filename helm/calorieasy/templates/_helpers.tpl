{{/* Common labels applied to every object. */}}
{{- define "calorieasy.labels" -}}
app.kubernetes.io/part-of: calorieasy
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end -}}

{{/* Name of the Secret holding APP_JWT_SECRET / POSTGRES_PASSWORD / API keys.
     Defaults to the chart-managed "calorieasy-secrets"; set secrets.existingSecret
     to point every service at a Secret you created out-of-band instead. */}}
{{- define "calorieasy.secretName" -}}
{{- .Values.secrets.existingSecret | default "calorieasy-secrets" -}}
{{- end -}}

{{/* Full image reference for a component:
     {{ include "calorieasy.image" (dict "root" $ "name" "auth-service") }} */}}
{{- define "calorieasy.image" -}}
{{- printf "%s/%s/%s:%s" .root.Values.image.registry .root.Values.image.repository .name (.root.Values.image.tag | toString) -}}
{{- end -}}
