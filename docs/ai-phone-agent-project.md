# AI Phone Agent — Proyecto futuro

## Idea
Servicio de atencion telefonica automatizada con IA. El agente atiende llamadas, entiende lo que dice la persona, y responde con voz (opcionalmente clonada). Caso de uso principal: dar turnos, responder preguntas frecuentes, derivar llamadas.

## Publico objetivo
Negocios chicos/medianos: consultorios, peluquerias, clinicas, estudios juridicos, talleres. Cualquiera que necesite recepcionista telefonica.

## Stack necesario
- **Telefonia**: Twilio (recibir/hacer llamadas, numeros virtuales ~$1/mes por numero + $0.013/min)
- **STT (Speech-to-Text)**: Deepgram (streaming en tiempo real, ~$0.01/min)
- **LLM**: OpenAI o Claude (procesar la conversacion, decidir respuesta)
- **TTS (Text-to-Speech)**: ElevenLabs (voz natural o clonada, desde $5/mes)
- **Backend**: Node.js o Python, sin necesidad de Electron — es un server puro
- **Base de datos**: Para turnos, clientes, configuracion por negocio

## Flujo de una llamada
```
Llamada entra (Twilio)
  -> Audio stream en tiempo real
  -> Deepgram transcribe a texto
  -> LLM procesa y genera respuesta
  -> ElevenLabs convierte respuesta a audio
  -> Audio vuelve al que llamo via Twilio
```

## Costos estimados (10,000 llamadas/mes de 3 min promedio)
| Servicio        | Costo mensual   |
|-----------------|-----------------|
| Twilio          | ~$390           |
| Deepgram STT    | ~$100           |
| LLM             | ~$100-500       |
| ElevenLabs      | ~$99-330        |
| **Total**       | **$700 - $1,300** |

## Modelo de negocio
- Suscripcion mensual por negocio: $30-50/mes
- Con 50 clientes: $1,500-2,500/mes de revenue
- Margen estimado: 50%+
- Valor: reemplaza o complementa una recepcionista

## Por que proyecto aparte (no Skynul)
1. Es un SaaS vertical con modelo de negocio propio
2. Backend puro, no necesita desktop app
3. Publico diferente (duenos de negocio, no usuarios tecnicos)
4. Se puede cobrar bien como servicio independiente

## Funcionalidades clave a implementar
- Dashboard web para que el negocio configure: horarios, servicios, preguntas frecuentes
- Integracion con Google Calendar para turnos
- Grabacion de llamadas (con consentimiento)
- Reportes: llamadas atendidas, turnos dados, preguntas frecuentes
- Multi-idioma (espanol/ingles minimo)
- Voz clonada opcional del dueno del negocio

## Alternativas a investigar
- **Vapi** — plataforma de voice AI agents, podria simplificar vs armar todo con Twilio+Deepgram
- **Retell AI** — similar a Vapi
- **Bland AI** — competidor directo en este espacio
