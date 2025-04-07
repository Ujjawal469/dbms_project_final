// Types matching backend responses

export interface ApiColumnSchema {
    name: string;
    type: string;
    isPrimaryKey: boolean;
    isNullable: boolean;
    isForeignKey: boolean;
    // Add other properties returned by your meta.service.getTableSchema
}

export interface ApiFetchDataResponse {
    data: any[];
    total: number;
}

// Add other request/response types as needed
