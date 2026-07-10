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

{{/* Is a Deployment owned by an HPA? Returns "true" (else empty) when autoscaling
     is enabled and the workload is listed in .Values.autoscaling.targets. Used to
     drop the static replicas field so `helm upgrade` doesn't fight the HPA.
     {{ include "calorieasy.hpaManaged" (dict "root" $ "name" "auth-service") }} */}}
{{- define "calorieasy.hpaManaged" -}}
{{- if and .root.Values.autoscaling.enabled (hasKey .root.Values.autoscaling.targets .name) -}}
true
{{- end -}}
{{- end -}}
