import { z } from 'zod'

export const FieldStyle = z.object({
  border: z.boolean().optional(),
  borderColor: z.string().optional(),
  fontWeight: z.enum(['normal','bold']).optional(),
  color: z.string().optional(),
}).partial()

export const Field = z.object({
  id: z.string().optional(),
  type: z.string(),
  label: z.string().optional(),
  name: z.string().optional(),
  placeholder: z.string().optional(),
  tooltip: z.string().optional(),
  value: z.any().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  options: z.array(z.union([z.string(), z.object({ label:z.string(), value:z.string() })])).optional(),
  height: z.number().optional(),
  required: z.boolean().optional(),
  tabIndex: z.number().optional(),
  style: FieldStyle.optional(),
  colSpan: z.number().min(1).max(12).optional(),
  visibility: z.any().optional(),
  columns: z.any().optional(),
})

export const Block = z.object({
  id: z.string().optional(),
  title: z.string(),
  fields: z.array(Field),
  visibility: z.any().optional(),
})

export const Section = z.object({
  id: z.string().optional(),
  title: z.string(),
  blocks: z.array(Block),
  visibility: z.any().optional(),
})

export const Page = z.object({
  id: z.string().optional(),
  title: z.string(),
  sections: z.array(Section),
  visibility: z.any().optional(),
})

export const Survey = z.object({
  id: z.string().optional(),
  title: z.string(),
  pages: z.array(Page)
})

export type Survey = z.infer<typeof Survey>

export const surveyJsonSchema = {
  name: "KirmasSurvey",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      pages: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            sections: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  title: { type: "string" },
                  blocks: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        title: { type: "string" },
                        fields: {
                          type: "array",
                          items: {
                            type: "object",
                            additionalProperties: false,
                            properties: {
                              type:    { type: "string" },
                              label:   { type: "string" },
                              name:    { type: "string" },
                              colSpan: { type: "number", minimum: 1, maximum: 12 },
                              required:{ type: "boolean" },
                              options: {
                                type: "array",
                                items: {
                                  anyOf: [
                                    { type: "string" },
                                    {
                                      type: "object",
                                      additionalProperties: false,
                                      properties: { label: { type: "string" }, value: { type: "string" } },
                                      required: ["label", "value"]
                                    }
                                  ]
                                }
                              }
                            },
                            required: ["type", "label", "name", "colSpan", "required", "options"]
                          }
                        }
                      },
                      required: ["title", "fields"]
                    }
                  }
                },
                required: ["title", "blocks"]
              }
            }
          },
          required: ["title", "sections"]
        }
      }
    },
    required: ["title", "pages"]
  },
  strict: true
} as const
