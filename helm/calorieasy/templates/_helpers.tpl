{{/* Common labels applied to every object. */}}
{{- define "calorieasy.labels" -}}
app.kubernetes.io/part-of: calorieasy
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end -}}

{{/* Full image reference for a component:
     {{ include "calorieasy.image" (dict "root" $ "name" "auth-service") }} */}}
{{- define "calorieasy.image" -}}
{{- printf "%s/%s/%s:%s" .root.Values.image.registry .root.Values.image.repository .name (.root.Values.image.tag | toString) -}}
{{- end -}}
