import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { DatabaseAuditService } from './database-audit.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('db-audit')
export class DatabaseAuditController {
  constructor(private readonly dbAuditService: DatabaseAuditService) { }

  /**
   * Sube una base de datos:
   * - Puede ser un archivo (p.ej. .bak)
   * - O puede ser un script en texto (body.script)
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDatabase(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { script?: string },
    @Res() res: Response,
  ) {
    try {
      /**
       * Escenario 1: El usuario sube un .bak o .sql como archivo
       * Escenario 2: El usuario envía un script en texto (body.script)
       */
      if (file) {
        await this.dbAuditService.uploadDatabaseFile(file);
      } else if (body.script) {
        await this.dbAuditService.uploadDatabaseScript(body.script);
      } else {
        return res.status(HttpStatus.BAD_REQUEST).json({
          message: 'No se recibió ni archivo ni script',
        });
      }

      return res.status(HttpStatus.OK).json({
        message: 'La base de datos se subió/restauró correctamente',
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Error al subir/restaurar la base de datos',
        error: error.message,
      });
    }
  }

  /**
   * Ejecuta el análisis sobre la DB subida/restaurada y retorna las anomalías.
   */
  @Get('anomalies')
  async analyzeDB(@Res() res: Response) {
    try {
      // Corre el análisis sobre la DB "subida"
      await this.dbAuditService.analyzeDatabase();

      // Obtenemos las anomalías encontradas
      const anomalies = await this.dbAuditService.getAnomalies();

      return res.status(HttpStatus.OK).json({
        message: 'Análisis completado',
        anomalies,
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Error al analizar la base de datos',
        error: error.message,
      });
    }
  }

  /**
   * Genera un reporte en PDF y lo envía como archivo descargable.
   * (Requiere que DatabaseAuditService tenga un método generatePdfReport())
   */
  @Get('pdf-report')
  async getPdfReport(@Res() res: Response) {
    try {
      // Si tu DatabaseAuditService encapsula la generación de PDF:
      const pdfBuffer = await this.dbAuditService.generateReport();

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="anomalies_report.pdf"',
        'Content-Length': pdfBuffer.length,
      });

      return res.end(pdfBuffer);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Error al generar el reporte PDF',
        error: error.message,
      });
    }
  }
}
